# Fase 4 / Semana 4 — checklist

Plan: [semana04-plan.md](semana04-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 4.

Los pasos globales (1–8) se mantienen. Los Pasos **2** y **3** se desglosan en minipasos verificables.  
El estado se marca **aquí**, no con “— OK” en el plan.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 1. Inventario cobertura 17 CCAA + leftover `placsp_menores` | OK | Docs en `docs/sources/`; 0 CCAA extra |
| 2. `placsp_menores` (reuso PLACSP) | OK | Minipasos 2.1–2.4 |
| 3. Matriz 17 CCAA + CCAA propia extra (o N/A) | OK | [cobertura-ccaa.md](../sources/cobertura-ccaa.md); 3.2 N/A |
| 4. Esquema matching (`tender_sources` / migración) | OK | `match_method`, `match_score`, `matched_at`, `review_status` |
| 5. Matching en pipeline común | OK | `matching.py` + lookup repo; tests auto/unmatched/pending |
| 6. Upsert respeta matching (auto / pending / unmatched) | OK | Reusa `tenders.id` en auto; no fusiona pending; idempotente |
| 7. Fixtures de solape + regresión | Pendiente | No debilitar tests Semanas 1–3 |
| 8. Catálogo + cierre | Pendiente | CHANGELOG; ADR N/A o nuevo |

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
| 3.2 CCAA propia extra (ficha + conector E2E) | N/A | 0 conectores; cobertura vía `placsp` + `placsp_agregadas` |

## Criterios transversales (cierre Semana 4)

| Ítem | Estado | Notas |
|---|---|---|
| Reejecutar no duplica (fuentes nuevas / matching) | Pendiente | Idempotencia upsert matching OK; cierre en Paso 7–8 |
| `source_sync` por cada fuente añadida | Pendiente | |
| Tests en verde (parser / matching / persistencia) | Pendiente | Matching + upsert unitarios OK; regresión = Paso 7 |
| No fusionar ambigüedades a ciegas | OK | `pending` → nueva fila `tenders` + `review_status` |
| ADRs estructurales (solo si hubo decisión nueva) | Pendiente | Default esperado: N/A |
| CHANGELOG actualizado | Pendiente | |

## Criterios de salida `docs/04` § Semana 4

| Criterio | Estado | Evidencia |
|---|---|---|
| Las 17 CCAA tienen una ruta de fuente identificada | OK | [cobertura-ccaa.md](../sources/cobertura-ccaa.md) |
| Las fuentes integradas muestran datos reales | Pendiente | Live previo A–D; nuevas según se implementen |
| Una licitación en dos fuentes compatibles → una fila canónica si hay confianza | Pendiente | Upsert auto OK (Paso 6); fixtures = Paso 7 |
| Casos ambiguos quedan pendientes de revisión | OK | `pending` no fusiona; `review_status` persistido |
| Tests de dedup en verde | Pendiente | Matching+upsert unitarios OK; fixtures/regresión = Paso 7 |
| Sin modelo de datos alternativo por fuente | Pendiente | Mismo canónico / pipeline común |

**Semana 4 abierta.** No mergear a `main` hasta OK explícito.

Verificación con datos reales (local, cuando toque): [docs/pruebas.md](../pruebas.md).
