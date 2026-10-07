# Semana 4 — Plan: cobertura territorial + deduplicación

> **Estado:** **cerrada** (Pasos 1–8). Siguiente = Semana 5 ([semana05-plan.md](semana05-plan.md)).  
> **Checklist:** [fase4-checklist.md](fase4-checklist.md)  
> **Precondición:** Semana 3 cerrada ([fase3-checklist.md](fase3-checklist.md)).  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. Reutilizar contrato `SourceConnector` + pipeline + upsert canónico de Semanas 1–3. ADR solo si hace falta cambiar arquitectura de verdad.  
> **Rama de trabajo:** `tecnico4/semana-04` (mergeada a `main` al cierre).  
> **Verificación live previa:** [docs/pruebas.md](../pruebas.md) — Partes A–D (`placsp`, `placsp_agregadas`, `catalunya`, `euskadi`).

---

## Partimos de

Semana 3 dejó **cuatro fuentes reales** sobre la misma tubería:

| `source_code` | Adaptador | Estado |
|---|---|---|
| `placsp` | Atom/CODICE (`PlacspSyndication` 643) | Semana 2 — live OK |
| `placsp_agregadas` | mismo adaptador (1044) | Semana 3 — live OK |
| `catalunya` | `SocrataConnector` (`ybgg-dgi6`) | Semana 3 — live OK |
| `euskadi` | `EuskadiConnector` REST | Semana 3 — live OK |

El upsert es idempotente **dentro de una fuente** por `(source_code, source_tender_id)`.  
`stages.deduplicate()` anota `payload['match']`; el upsert reutiliza `tenders.id` si `auto` y crea fila nueva si `pending`/`unmatched` (Pasos 5–6).

Meta de Semana 4 (`docs/04` § Semana 4):

1. **Cobertura territorial:** las 17 CCAA tienen una **ruta de datos oficial identificada** (propia, agregación o perfiles alojados) y documentada.
2. **Deduplicación funcional:** una licitación vista en dos fuentes compatibles se representa **una sola vez** cuando hay confianza suficiente; lo ambiguo queda `review_status = pending`.

Fuera de esta semana (Semana 5+): FTS / Auth / alertas UI, TED, subvenciones, motor de revisión humana, cron de producción.

---

## Cómo lo hacemos

1. Cumplir tareas y criterios de `docs/04-roadmap-mvp.md` § Semana 4.
2. **No** interpretar “17 CCAA cubiertas” como “17 conectores nuevos”. El roadmap define cobertura como **ruta de fuente identificada**: conector propio, **agregación** (`placsp_agregadas`) o **perfiles alojados** (`placsp`). Ver matriz en [cobertura-ccaa.md](../sources/cobertura-ccaa.md).
3. Cada fuente **nueva que se implemente**: ficha en `docs/sources/`, `source_sync`, fixture, tests, config de acceso y workflow/job.
4. La documentación de fuentes y cobertura vive en `docs/sources/` (no en este plan). Aquí solo estructura + [Decisiones durante la ejecución](#decisiones-durante-la-ejecución).
5. Reutilizar adaptadores **solo** con compatibilidad técnica y semántica real (PLACSP Atom/CODICE, Socrata, REST propio, CSV puntual).
6. Fuente oficial primero; sin scraping si hay feed/API/Open Data adecuado.
7. Mismo modelo canónico. Ampliar `tender_sources` (o tabla auxiliar justificada) **vía migración** para matching; no DDL paralelo por fuente.
8. Dedup en el **pipeline común**, no dentro de cada parser. El matching debe consultar el canónico ya persistido (el pass-through actual no ve otras fuentes).
9. No fusionar ambigüedades a ciegas. NIF/CIF es señal primaria de organismo; el **nombre nunca** es identidad única.
10. Priorizar cobertura/esfuerzo; si una CCAA propia se atasca: documentar hueco y seguir (regla de alcance del roadmap).
11. Pasos pequeños y verificables; secretos fuera del código; push/merge a `main` solo con OK explícito.
12. ADR solo ante cambio estructural real; si no, checklist en `N/A`.

---

## Pasos

### 1. Inventario de cobertura de las 17 CCAA (solo documentación)

Contrastar catálogo de referencia + fichas oficiales + lo ya integrado. Documentar en `docs/sources/`:

- cobertura territorial de las 17 CCAA (ruta propia / agregación / perfiles alojados / hueco);
- leftover estatal `placsp_menores` (ficha al estilo de las fuentes Semanas 2–3).

Registrar en [Decisiones](#decisiones-durante-la-ejecución) el orden de ataque y si hay CCAA propia extra esta semana. **No** implementar conectores aún.

**Listo cuando:** documentación revisable en `docs/sources/` + decisiones breves en este plan; checklist Paso 1.

Documentación resultante:

- [docs/sources/cobertura-ccaa.md](../sources/cobertura-ccaa.md)
- [docs/sources/placsp_menores.md](../sources/placsp_menores.md)
- [docs/sources/README.md](../sources/README.md)

### 2. Leftover estatal — `placsp_menores` (reuso PLACSP)

Mismo patrón que `placsp_agregadas`: parametrizar `PlacspSyndication` (`sindicacion_1143`, feed `contratosMenoresPerfilesContratantes`), discover/fetch, RAW, parse/normalize/upsert, CLI, workflow.  
Ficha de fuente: [docs/sources/placsp_menores.md](../sources/placsp_menores.md).

**Listo cuando (paso global):** corrida local (fixture) deja sync success, RAW trazable y filas canónicas con `source_code=placsp_menores`; reejecutar no duplica; tests sin red.

#### 2.1 Ficha `docs/sources/placsp_menores.md`

Mismo esquema que `placsp.md` / `placsp_agregadas.md` (si aún no está completa desde el Paso 1, cerrarla aquí).

**Listo cuando:** documento revisable alineado con el acceso real.

#### 2.2 Discover + fetch

Añadir `PLACSP_MENORES` a `PlacspSyndication`; reutilizar `download_bytes`. Tests sin red.

**Listo cuando:** `artifact_key` / `source_url` estables; misma política timeout/retry/`max_bytes`.

#### 2.3 RAW + parse + normalize + upsert

Prefijo Storage `raw/placsp_menores/`. Reutilizar parser CODICE + etapas del pipeline + `CanonicalRepository`. Unique `(placsp_menores, source_tender_id)`.

**Listo cuando:** fixture → canónico + `source_sync` success; 2ª pasada → updated, sin duplicados.

#### 2.4 CLI + workflow

`run-placsp --syndication placsp_menores`; extender `ingest-placsp.yml`. Manual, dry-run por defecto, cron off.

**Listo cuando:** CLI documentado; workflow en repo.

### 3. Matriz de cobertura 17 CCAA + CCAA propias extra

Asegurar que [docs/sources/cobertura-ccaa.md](../sources/cobertura-ccaa.md) y el [README del catálogo](../sources/README.md) reflejan la ruta de cada comunidad.

Si el Paso 1 selecciona **una** CCAA propia extra: repetir el patrón Semana 3 (ficha → conector → RAW → upsert → CLI → workflow → tests).  
Si no selecciona ninguna: marcar minipaso 3.2 como **N/A** en el checklist.

**No** implementar un conector por CCAA “para llegar a 17”: la mayoría ya tiene ruta vía `placsp` o `placsp_agregadas`.

**Listo cuando:** las 17 CCAA figuran documentadas en `docs/sources/`; cada conector extra (si existe) cumple el contrato habitual.

### 4. Deduplicación — esquema de matching

El modelo ya tiene `tenders.id` (canónico) y `tender_sources (source_code, source_tender_id)`. Falta persistir la **decisión de matching** que pide el roadmap:

```text
canonical_tender_id   → tender_sources.tender_id (ya existe)
source_code           → ya existe
source_tender_id      → ya existe
match_method
match_score
matched_at
review_status
```

**Propuesta por defecto (sin ADR si se mantiene el contrato):** columnas nuevas en `tender_sources` vía migración versionada + RLS intacto. Tabla auxiliar de candidatos solo si hace falta guardar un match pendiente sin contaminar la fila canónica.

Valores iniciales previstos de `review_status`: `unmatched` | `auto` | `pending`.  
No fusionar si la confianza es insuficiente (`pending`).

**Listo cuando:** `supabase db reset` local OK; tipos TS regenerados si el esquema expuesto cambia.

### 5. Matching en el pipeline común

Sustituir el pass-through de `stages.deduplicate`. El matching **no cabe** en un lote ciego: debe consultar licitaciones ya persistidas de **otras** fuentes (lookup en `CanonicalRepository` / equivalente).

Niveles (roadmap):

1. identificador exacto de fuente (ya cubierto por unique intra-fuente);
2. expediente + organismo (NIF/CIF o id de plataforma; nunca solo el nombre);
3. otras combinaciones fiables (CPV, importe, fechas, organismo, ubicación);
4. similitud de título/objeto.

Anotar el `SourceRecord` con la decisión; **no** mezclar lógica de producto en el parser.

Algoritmo concreto, pesos y umbrales son 🎨 libres. Implementación en Python del ETL (no adelantar FTS/`pg_trgm` de Semana 5).

**Listo cuando:** tests unitarios sin red cubren: match de alta confianza, no-match, y caso ambiguo → `pending` (sin fusionar).

### 6. Upsert respeta el matching

Si match `auto` de alta confianza: reutilizar `tenders.id` existente y añadir/actualizar `tender_sources` de la fuente nueva.  
Si `pending` o `unmatched`: crear licitación nueva (no fusionar) y registrar `review_status`.  
Reejecutar el mismo `(source_code, source_tender_id)` sigue siendo idempotente.

**Listo cuando:** test in-memory (+ Postgres opcional) demuestra: dos fuentes → una fila `tenders` en match alto; dos filas si es ambiguo; 2ª pasada no duplica `tender_sources`.

### 7. Fixtures de solape + regresión de fuentes existentes

Al menos un par de fixtures que representen **la misma** licitación en dos `source_code` (p. ej. CODICE vs Catalunya/Euskadi sintéticos), más un par que **no** deban fusionarse.

No debilitar tests de Semanas 1–3. Correr la batería completa de ingestion.

**Listo cuando:** tests de dedup en verde; regresión previa en verde.

### 8. Catálogo + cierre

Actualizar `docs/sources/README.md`, CHANGELOG, checklist. ADR `N/A` o ADR nuevo si hubo decisión estructural. Verificación live de menores / CCAA extra / un caso de dedup: solo cuando el paso correspondiente esté listo y de forma acotada (mismo patrón que `docs/pruebas.md`).

**Hecho:** catálogo + checklist cerrados; [ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md) (CCAA extra N/A) + [ADR 010](../adr/010-match-candidate-tender-id-en-tender-sources.md) (candidato best); handoff Semana 5; CHANGELOG con cierre Semana 4.

**Listo cuando:** criterios de salida de `docs/04` § Semana 4 cumplidos → **cumplidos** (ver tabla en checklist).

**Fuera de alcance (→ Semana 5+):** buscador FTS, Auth/RLS de usuarios en UI, motor de alertas/email, web de ficha/dashboard, TED, subvenciones, UI de revisión humana de matches `pending`, cron de producción, infra nueva sin ADR.

---

## Decisiones durante la ejecución

Registro de lo acordado al cerrar (o antes de) cada paso:

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio Semana 4 | Ejecutar **paso a paso** con revisión | Igual que Semanas 0–3 |
| Plan | Rama de trabajo = `tecnico4/semana-04` | No mergear a `main` hasta OK explícito |
| Plan | Sin ADRs previos; ADR solo si hay cambio estructural | Respetar arquitectura ya fijada |
| Plan | “17 CCAA” = rutas documentadas, no 17 conectores | Criterio de salida del roadmap |
| Plan | Dedup en pipeline común + lookup al canónico persistido | El pass-through actual no ve otras fuentes |
| Plan | Matching persistido en `tender_sources` (columnas) por defecto | Encaja el contrato ya existente; migración Semana 4 |
| Plan | No adelantar `pg_trgm`/FTS | Eso es Semana 5; similitud de título en el ETL |
| Plan | `placsp_menores` antes de CCAA extra | Reuso máximo; leftover Semana 3 ([ADR 008](../adr/008-placsp-menores-aplazado-semana4.md)) |
| Plan | Documentación de fuentes/cobertura solo en `docs/sources/` | El plan no acumula fichas ni matrices largas |
| Paso 1 | `placsp_menores` = `sindicacion_1143` / `contratosMenoresPerfilesContratantes` | Confirmado en ficha Hacienda; conector en Paso 2 |
| Paso 1 | 2 propias (Cat, Euskadi) + 5 agregación + 10 perfiles alojados `placsp` | Cumple “ruta identificada” sin 17 conectores; ver [cobertura-ccaa.md](../sources/cobertura-ccaa.md) |
| Paso 1 | CCAA propia extra Semana 4 = **0 (N/A)** | Priorizar menores + dedup; Open Data / menores de agregadas = backlog ([ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md)) |
| Paso 1 | Fichas en `cobertura-ccaa.md` + `placsp_menores.md` | Detalle en catálogo de fuentes, no en el plan |
| Paso 2.2 | `PLACSP_MENORES` en `PlacspSyndication` | Reuso discover/fetch; keys `contratosMenoresPerfilesContratantes_YYYYMM.zip` |
| Paso 2.3 | RAW/parse/normalize/upsert reutilizan pipeline PLACSP | Prefijo `raw/placsp_menores/`; unique `(placsp_menores, source_tender_id)` |
| Paso 2.4 | CLI + `ingest-placsp.yml` admiten `placsp_menores` | Dry-run default; cron off |
| Paso 4 | Matching en columnas de `tender_sources` (migración) | `unmatched`/`auto`/`pending`; sin tabla auxiliar; candidato best → [ADR 010](../adr/010-match-candidate-tender-id-en-tender-sources.md) |
| Paso 5 | `stages.deduplicate` + `MatchLookup` en repo canónico | Anota `payload['match']`; título solo → `pending`; fusión = Paso 6 |
| Paso 6 | Upsert respeta `payload['match']` | `auto` reusa `tenders.id`; `pending`/`unmatched` crean fila; idempotente |
| Paso 7 | Fixtures solape PLACSP↔Euskadi + regresión | Auto-merge / no-merge; Catalunya sin NIF no auto; suite ingestion verde |
| Paso 8 | Catálogo + cierre | Checklist cerrado; handoff Semana 5; ADRs 009–010 |
| Pruebas live (post Paso 6–7) | Columna `match_candidate_tender_id` en `tender_sources` (candidato **best** en `pending`) | Sin ella no se ve en Studio a qué tender se parece un `pending`; no cambia `auto`/`unmatched`. Evolución prevista cuando exista UI de revisión humana: tabla `match_suggestions` (varios candidatos por fila pending, no solo el best). [ADR 010](../adr/010-match-candidate-tender-id-en-tender-sources.md) |

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 4 (y §1 corte MVP: cobertura + dedup)  
- [docs/01-arquitectura-fija.md](../01-arquitectura-fija.md) §§ 5–8 (conectores, identidad, migraciones)  
- [docs/00-onboarding.md](../00-onboarding.md) (fuentes, RAW, entity resolution)  
- [docs/sources/README.md](../sources/README.md) · [cobertura-ccaa.md](../sources/cobertura-ccaa.md) · [placsp_menores.md](../sources/placsp_menores.md) · [placsp.md](../sources/placsp.md) · [placsp_agregadas.md](../sources/placsp_agregadas.md) · [catalunya.md](../sources/catalunya.md) · [euskadi.md](../sources/euskadi.md)  
- [docs/pruebas.md](../pruebas.md)  
- [fase4-checklist.md](fase4-checklist.md) · [semana03-plan.md](semana03-plan.md) · [fase3-checklist.md](fase3-checklist.md)
