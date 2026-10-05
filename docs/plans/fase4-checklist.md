# Fase 4 / Semana 4 — checklist

Plan: [semana04-plan.md](semana04-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 4.

Los pasos globales (1–8) se mantienen. Los Pasos **2** y **3** se desglosan en minipasos verificables.  
El estado se marca **aquí**, no con “— OK” en el plan.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 1. Inventario cobertura 17 CCAA + leftover `placsp_menores` | OK | Docs en `docs/sources/`; 0 CCAA extra ([ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md)) |
| 2. `placsp_menores` (reuso PLACSP) | OK | Minipasos 2.1–2.4 |
| 3. Matriz 17 CCAA + CCAA propia extra (o N/A) | OK | [cobertura-ccaa.md](../sources/cobertura-ccaa.md); 3.2 N/A ([ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md)) |
| 4. Esquema matching (`tender_sources` / migración) | OK | `match_*` / `review_status` + `match_candidate_tender_id` (best en `pending`; [ADR 010](../adr/010-match-candidate-tender-id-en-tender-sources.md)) |
| 5. Matching en pipeline común | OK | `matching.py` + lookup repo; tests auto/unmatched/pending |
| 6. Upsert respeta matching (auto / pending / unmatched) | OK | Reusa `tenders.id` en auto; no fusiona pending; persiste candidato best; idempotente |
| 7. Fixtures de solape + regresión | OK | `fixtures/overlap/` + `test_overlap_dedup`; suite ingestion verde |
| 8. Catálogo + cierre | OK | Catálogo; CHANGELOG; ADR N/A; handoff Semana 5 |

## Paso 2 — minipasos (`placsp_menores`)

| Minipaso | Estado | Notas |
|---|---|---|
| 2.1 Ficha `docs/sources/placsp_menores.md` | OK | Misma profundidad que agregadas/perfiles |
| 2.2 Discover + fetch | OK | `PLACSP_MENORES` / `sindicacion_1143`; tests sin red |
| 2.3 RAW + parse + normalize + upsert | OK | Prefijo `raw/placsp_menores/`; unique `(placsp_menores, …)`; tests sin red |
| 2.4 CLI + workflow | OK | `run-placsp --syndication placsp_menores`; dry-run default; cron off |

## Paso 3 — minipasos (cobertura territorial)

| Minipaso | Estado | Notas |
|---|---|---|
| 3.1 Matriz 17 CCAA en catálogo | OK | [cobertura-ccaa.md](../sources/cobertura-ccaa.md) |
| 3.2 CCAA propia extra (ficha + conector E2E) | N/A | 0 conectores; cobertura vía `placsp` + `placsp_agregadas`; [ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md) |

## Criterios transversales (cierre Semana 4)

| Ítem | Estado | Notas |
|---|---|---|
| Reejecutar no duplica (fuentes nuevas / matching) | OK | Matching upsert + overlap (2ª pasada); pipeline `placsp_menores` |
| `source_sync` por cada fuente añadida | OK | `placsp_menores` vía pipeline/tests (`test_placsp_menores_upsert`); A–D live previo |
| Tests en verde (parser / matching / persistencia) | OK | Suite ingestion completa en verde (Paso 7 + cierre) |
| No fusionar ambigüedades a ciegas | OK | `pending` → nueva fila `tenders` + `review_status` |
| Candidato best en `pending` (`match_candidate_tender_id`) | OK | Migración + upsert; tests; [ADR 010](../adr/010-match-candidate-tender-id-en-tender-sources.md); evolución `match_suggestions` anotada |
| ADRs estructurales (solo si hubo decisión nueva) | OK | [ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md) (CCAA extra N/A); [ADR 010](../adr/010-match-candidate-tender-id-en-tender-sources.md) (candidato best) |
| CHANGELOG actualizado | OK | Unreleased con entradas Semana 4 + cierre |

## Criterios de salida `docs/04` § Semana 4

| Criterio | Estado | Evidencia |
|---|---|---|
| Las 17 CCAA tienen una ruta de fuente identificada | OK | [cobertura-ccaa.md](../sources/cobertura-ccaa.md) |
| Las fuentes integradas muestran datos reales | OK | Live A–D ([pruebas.md](../pruebas.md)); `placsp_menores` mismo canal PLACSP + tests/CLI |
| Una licitación en dos fuentes compatibles → una fila canónica si hay confianza | OK | Fixtures overlap PLACSP↔Euskadi (`test_overlap_dedup`) |
| Casos ambiguos quedan pendientes de revisión | OK | `pending` no fusiona; `review_status` + `match_candidate_tender_id` (best) |
| Tests de dedup en verde | OK | Matching + upsert + overlap; regresión suite ingestion |
| Sin modelo de datos alternativo por fuente | OK | Mismo canónico / pipeline común |

**Semana 4 cerrada.** Siguiente: Semana 5 (búsqueda + Auth + alertas) — [semana05-plan.md](semana05-plan.md).

Verificación con datos reales (local): [docs/pruebas.md](../pruebas.md).
