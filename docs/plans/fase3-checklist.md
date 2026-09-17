# Fase 3 / Semana 3 — checklist

Plan: [semana03-plan.md](semana03-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 3.

Los pasos globales (1–10) se mantienen. Los Pasos **3**, **4** y **8** se desglosan en minipasos verificables.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 1. Inventario priorizado (estatal + primeras CCAA) | OK | Estatal: agregadas→menores. CCAA cola: catalunya→euskadi + reservas |
| 2. Ficha `docs/sources/` fuente estatal ampliada | OK | `placsp_agregadas.md` (`sindicacion_1044`) |
| 3. Conector estatal (discover + fetch) | OK | Minipasos 3.1–3.2; ver tabla abajo |
| 4. RAW + parse + normalize + upsert (estatal) | OK | 4.1–4.5; `run-placsp --syndication placsp_agregadas` |
| 5. Workflow/job fuente estatal | OK | `ingest-placsp.yml` + input `syndication=placsp_agregadas`; dry-run default; cron off |
| 6. Adaptador CSV genérico (o N/A) | N/A | Familia CSV no priorizada; reserva CSV → conector puntual |
| 7. Adaptador REST/Socrata (o N/A) | OK | `SocrataConnector` + preset `CATALUNYA` (`ybgg-dgi6`); ficha + tests sin red |
| 8. CCAA propia #1 | OK | `catalunya` 8.1–8.6; live SODA + idempotencia en [docs/pruebas.md](../pruebas.md) |
| 9. CCAA propia #2 (+) | OK | `euskadi` 9.1–9.5; live API + idempotencia en [docs/pruebas.md](../pruebas.md) Parte D |
| 10. Catálogo + regresión + cierre | — | `docs/sources/README.md`, tests, CHANGELOG, ADR |

## Paso 3 — minipasos (conector estatal)

| Minipaso | Estado | Notas |
|---|---|---|
| 3.1 Discover | OK | `PlacspSyndication` / `PLACSP_AGREGADAS`; keys estables; tests sin red |
| 3.2 Fetch | OK | `download_bytes` + `fetch_transport`; URL `sindicacion_1044`; tests sin red |

## Paso 4 — minipasos (RAW → canónico, fuente estatal)

| Minipaso | Estado | Notas |
|---|---|---|
| 4.1 Validar + guardar RAW Storage | OK | Prefijo `raw/placsp_agregadas/`; helper Semana 2; tests mock (+ live skip) |
| 4.2 Parse Atom/CODICE → `SourceRecord` | OK | Reuso parser Semana 2; ZIP `PlataformasAgregadasSinMenores.atom`; tests sin red |
| 4.3 Normalize + identidad organismos | OK | Reuso etapas Semana 2; tests agregadas HIGH/LOW; sin red |
| 4.4 Upsert canónico + `source_sync` + trazabilidad | OK | Reuso repo Semana 2; unique `(placsp_agregadas, …)`; pipeline sync + tests |
| 4.5 CLI / E2E local controlado | OK | `run-placsp --syndication placsp_agregadas --fixture --dry-run` |

## Paso 8 — minipasos (CCAA #1 `catalunya`)

Parse/normalize del adaptador ya cubiertos en Paso 7.

| Minipaso | Estado | Notas |
|---|---|---|
| 8.1 Documentación ficha CCAA #1 | OK | `docs/sources/catalunya.md` alcance E2E (RAW/CLI/workflow) |
| 8.2 Validar + guardar RAW Storage | OK | Prefijo `raw/catalunya/`; helpers Semana 2; JSON page; tests mock (+ live skip) |
| 8.3 Upsert + `source_sync` + trazabilidad | OK | Unique `(catalunya, id_intern)`; pipeline sync + tests; sin red |
| 8.4 CLI / E2E local controlado | OK | `run-catalunya --fixture --dry-run`; sin red SODA |
| 8.5 Workflow/job controlado | OK | `ingest-catalunya.yml`; dry-run default; cron off |
| 8.6 Verificación live SODA + idempotencia | OK | 1×1000 filas reales; 2ª corrida `records_new=0`; [docs/pruebas.md](../pruebas.md) Parte C |

## Paso 9 — CCAA #2 `euskadi`

| Minipaso | Estado | Notas |
|---|---|---|
| 9.1 Ficha + conector discover/fetch/parse | OK | `docs/sources/euskadi.md`; `EuskadiConnector`; tests sin red |
| 9.2 RAW + upsert + `source_sync` | OK | Prefijo `raw/euskadi/`; unique `(euskadi, id)`; tests |
| 9.3 CLI / E2E local | OK | `run-euskadi --fixture --dry-run` |
| 9.4 Workflow | OK | `ingest-euskadi.yml`; dry-run default; cron off |
| 9.5 Verificación live API + idempotencia | OK | 1×10 avisos reales; 2ª corrida `records_new=0`; [docs/pruebas.md](../pruebas.md) Parte D |

## Criterios transversales (cierre Semana 3)

| Ítem | Estado | Notas |
|---|---|---|
| Reejecutar no duplica (fuentes nuevas) | OK | Live `placsp_agregadas` + `catalunya` + `euskadi`: 2ª corrida `records_new=0`; ver [docs/pruebas.md](../pruebas.md) |
| `source_sync` por cada fuente añadida | OK | Live local: `prueba-live-agregadas-*`, `prueba-live-catalunya-*`, `prueba-live-euskadi-*` |
| Tests en verde (parser / adaptadores / persistencia) | OK | 112 passed en baseline pre-live `euskadi` (incl. regresión PLACSP/Catalunya) |
| ADRs estructurales (solo si hubo decisión nueva) | — | Si no → N/A |
| CHANGELOG actualizado | OK | Ir actualizando por hito + entradas `docs/pruebas.md` |

Cuando los pasos globales relevantes estén en OK → Semana 4 (cobertura territorial 17 CCAA + deduplicación).

Verificación con datos reales (local): [docs/pruebas.md](../pruebas.md) — Parte B (`placsp_agregadas`) · Parte C (`catalunya`) · Parte D (`euskadi`).
