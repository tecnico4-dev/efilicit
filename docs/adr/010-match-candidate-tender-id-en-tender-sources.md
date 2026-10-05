# 010 - Candidato best de matching en `tender_sources.match_candidate_tender_id`

**Fecha:** 25-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Semana 4 persiste la decisión de matching multi-fuente en columnas de `tender_sources` (migración base: `match_method`, `match_score`, `matched_at`, `review_status` ∈ `unmatched` | `auto` | `pending`). El upsert:

- en `auto` reutiliza `tenders.id` y fusiona el enlace de fuente;
- en `pending` / `unmatched` **no** fusiona: crea (o mantiene) una fila canónica propia.

En pruebas live quedó un hueco operativo: con `review_status = pending` no se veía en Studio **a qué** tender se parecía el caso ambiguo. El pipeline ya elegía un candidato “best” en memoria (`payload['match'].matched_tender_id`), pero no quedaba anclado en el esquema expuesto.

Una tabla auxiliar `match_suggestions` (N candidatos por fila pending) encaja mejor cuando exista UI de revisión humana; en Semana 4 esa UI está fuera de alcance.

---

## Decisión

Añadir en `public.tender_sources` la columna:

- `match_candidate_tender_id uuid null` → FK a `tenders(id)` (ON DELETE SET NULL)

Semántica:

- Solo informativa cuando `review_status = pending` (candidato **best**; no implica fusión).
- `null` en `auto` y `unmatched`.
- No cambia la política de fusión ni los valores de `review_status`.
- Evolución prevista (Semana 5+ / UI de revisión): tabla `match_suggestions` con varios candidatos; esta columna puede quedar como atajo del best o retirarse entonces vía ADR nuevo.

Migración: `supabase/migrations/20260925120000_semana4_match_candidate_tender_id.sql`.

### Alternativas descartadas

- **No persistir el candidato hasta la UI.** Descartada: impide inspeccionar `pending` en Studio/SQL durante Semana 4.
- **Crear ya `match_suggestions` (N filas).** Descartada: sobrediseño sin consumidor UI; más RLS/migración sin beneficio inmediato.
- **Reutilizar `tender_id` de la fila pending para apuntar al candidato.** Descartada: `tender_id` es la licitación canónica de **esta** fuente; mezclarlo con el candidato rompería el modelo “pending = no fusionar”.

---

## Consecuencias

### Positivas

- Los `pending` son auditables sin UI: se ve el best sugerido.
- El contrato de fusión (`auto` vs no fusionar) permanece intacto.
- Deja un camino claro hacia `match_suggestions` sin bloquear Semana 4.

### Negativas / riesgos

- Un solo candidato (best) puede ocultar empates cercanos hasta exista tabla N-candidatos.
- Hay que mantener la columna alineada en re-ingestas (refresco / clear al pasar a `unmatched`).

---

## Verificación

- Migración `20260925120000_semana4_match_candidate_tender_id.sql` aplicada en reset local.
- Upsert / repo canónico escriben `match_candidate_tender_id` solo en `pending`.
- `docs/plans/semana04-plan.md`: decisión post Paso 6–7 documentada.
- Tests de matching / overlap cubren pending con candidato best.

---

## Referencias

- `docs/04-roadmap-mvp.md` § Semana 4 (deduplicación)
- `docs/01-arquitectura-fija.md` §§ 5–8 (identidad / migraciones)
- `docs/plans/semana04-plan.md` · `docs/plans/fase4-checklist.md`
- `supabase/migrations/20260918100000_semana4_tender_sources_matching.sql`
- `supabase/migrations/20260925120000_semana4_match_candidate_tender_id.sql`
- `ingestion/src/efilicit_ingestion/pipeline/matching.py`
- `ingestion/src/efilicit_ingestion/pipeline/canonical_repo.py`
