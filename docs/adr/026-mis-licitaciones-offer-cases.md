# 026 - Mis licitaciones: expediente de oferta (`offer_*`)

**Fecha:** 2026-11-06

**Estado:** Aceptado

**Reemplaza:** Ninguno (extiende [023](023-mis-licitaciones-pipeline-compartido.md); las tablas `bid_*` quedan como legacy de `/my-tenders` «eliminar» hasta borrado explícito)

**Reemplazado por:** Ninguno

---

## Contexto

El espacio de oferta acordado (matriz requisito→evidencia, sobres, go/no-go, KPIs) no cabe bien en el checklist plano de `bid_case_checklist_items`. La UI nueva vive en `/mis-licitaciones` y no debe seguir escribiendo el modelo legacy. Hace falta un expediente propio y **migrar** los casos ya existentes (sobre todo el histórico Eficen en local) sin duplicar licitaciones canónicas.

## Decisión

1. Tablas nuevas (mismo tenant compartido `is_app_user()` que el 023):
   - `offer_cases` — una fila por `tenders.id` en el pipeline de oferta (única por `tender_id`).
   - `offer_requirements` — matriz de requisitos (categoría, tipo, cumplimiento, preparación, sobre, fechas, ref. pliego).
2. Etapas iniciales (compatibles con el histórico migrado + huecos del producto):  
   `interes` | `analisis` | `preparacion` | `presentada` | `en_evaluacion` | `requerimiento` | `adjudicada` | `no_adjudicada` | `descartada` | `subcontrata` | `desierta`.  
   Activas = no terminales; histórico = `adjudicada` | `no_adjudicada` | `descartada` | `subcontrata` | `desierta`.
3. Migración one-shot en la misma migración SQL: copiar `bid_cases` → `offer_cases` **preservando `id`**, y checklist → `offer_requirements` (categoría `otros`, preparación según `done_at`, cumplimiento `sin_verificar`).
4. UI `/mis-licitaciones` lee/escribe solo `offer_*`. `/my-tenders` (label «eliminar») sigue en `bid_*` hasta que se retire.
5. `legacy_bid_case_id` en `offer_cases` apunta al origen cuando exista (misma uuid en el backfill).

### Alternativas descartadas

- **ALTER in-place de `bid_cases`.** Rompe la pestaña legacy aún visible y mezcla dos UIs en un esquema a medias.
- **No preservar `id`.** Rompería bookmarks y forzaría remap en la UI.
- **Tabla solo histórica.** El producto es un único pipeline; el histórico es filtro de etapa.

## Consecuencias

### Positivas

- Separación clara legacy vs espacio de oferta.
- Histórico Eficen disponible en el modelo nuevo sin re-importar desde Excel.
- Base para Incremento 1 (matriz, KPIs) sin Storage ni IA.

### Negativas / riesgos

- Dos pipelines en paralelo hasta borrar `bid_*` (riesgo de altas solo en uno). Mitigación: «Añadir a Mis licitaciones» escribe en `offer_cases`.
- Campos de Incrementos 2–5 (equipo, hitos tipados, biblioteca con caducidad) aún no están; se añaden en migraciones posteriores.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Desalineación `bid_cases` ↔ `offer_cases` tras el backfill | No sync continuo; retirar `bid_*` pronto |
| Etapas nuevas vacías en UI | Labels + Kanban las contemplan; datos migrados usan etapas 023 |

## Referencias

- [023](023-mis-licitaciones-pipeline-compartido.md)
- Requisitos producto: espacio de preparación de oferta (2026-11-04)
- Reglas: RLS; sin `service_role` en web; cambios de DB = migraciones versionadas
