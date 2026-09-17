# Fase 4 / Semana 4 — checklist

Plan: [semana04-plan.md](semana04-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 4.

Los pasos globales (1–8) se mantienen. Los Pasos **2** y **3** se desglosan en minipasos verificables.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 1. Inventario cobertura 17 CCAA + leftover `placsp_menores` | OK | Matriz en plan + catálogo; menores confirmado; 0 CCAA extra |
| 2. `placsp_menores` (reuso PLACSP) | Pendiente | Minipasos 2.1–2.4 |
| 3. Matriz 17 CCAA + CCAA propia extra (o N/A) | OK | 3.1 catálogo; 3.2 N/A (decisión Paso 1) |
| 4. Esquema matching (`tender_sources` / migración) | Pendiente | `match_method`, `match_score`, `matched_at`, `review_status` |
| 5. Matching en pipeline común | Pendiente | Sustituir pass-through; lookup canónico |
| 6. Upsert respeta matching (auto / pending / unmatched) | Pendiente | Idempotente; no fusionar ambiguos |
| 7. Fixtures de solape + regresión | Pendiente | No debilitar tests Semanas 1–3 |
| 8. Catálogo + cierre | Pendiente | CHANGELOG; ADR N/A o nuevo |

## Paso 2 — minipasos (`placsp_menores`)

| Minipaso | Estado | Notas |
|---|---|---|
| 2.1 Ficha `docs/sources/placsp_menores.md` | Pendiente | `sindicacion_1143` |
| 2.2 Discover + fetch | Pendiente | `PlacspSyndication`; tests sin red |
| 2.3 RAW + parse + normalize + upsert | Pendiente | Prefijo `raw/placsp_menores/`; unique `(placsp_menores, …)` |
| 2.4 CLI + workflow | Pendiente | `run-placsp --syndication placsp_menores`; dry-run default; cron off |

## Paso 3 — minipasos (cobertura territorial)

| Minipaso | Estado | Notas |
|---|---|---|
| 3.1 Matriz 17 CCAA en catálogo | OK | [docs/sources/README.md](../sources/README.md) § Cobertura territorial |
| 3.2 CCAA propia extra (ficha + conector E2E) | N/A | Paso 1: 0 conectores; cobertura vía `placsp_agregadas` |

## Criterios transversales (cierre Semana 4)

| Ítem | Estado | Notas |
|---|---|---|
| Reejecutar no duplica (fuentes nuevas / matching) | Pendiente | |
| `source_sync` por cada fuente añadida | Pendiente | |
| Tests en verde (parser / matching / persistencia) | Pendiente | Incluye regresión previa |
| No fusionar ambigüedades a ciegas | Pendiente | `review_status = pending` |
| ADRs estructurales (solo si hubo decisión nueva) | Pendiente | Default esperado: N/A |
| CHANGELOG actualizado | Pendiente | |

## Criterios de salida `docs/04` § Semana 4

| Criterio | Estado | Evidencia |
|---|---|---|
| Las 17 CCAA tienen una ruta de fuente identificada | OK | Matriz Paso 1 / catálogo README |
| Las fuentes integradas muestran datos reales | Pendiente | Live previo A–D; nuevas según se implementen |
| Una licitación en dos fuentes compatibles → una fila canónica si hay confianza | Pendiente | Tests Paso 6–7 |
| Casos ambiguos quedan pendientes de revisión | Pendiente | `review_status = pending` |
| Tests de dedup en verde | Pendiente | |
| Sin modelo de datos alternativo por fuente | Pendiente | Mismo canónico / pipeline común |

**Semana 4 abierta.** No mergear a `main` hasta OK explícito.

Verificación con datos reales (local, cuando toque): [docs/pruebas.md](../pruebas.md).
