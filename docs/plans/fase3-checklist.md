# Fase 3 / Semana 3 — checklist

Plan: [semana03-plan.md](semana03-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 3.

Los pasos globales (1–10) se mantienen. Los Pasos **3** y **4** se desglosan en minipasos verificables.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 1. Inventario priorizado (estatal + primeras CCAA) | OK | Estatal: agregadas→menores. CCAA cola: catalunya→euskadi + reservas |
| 2. Ficha `docs/sources/` fuente estatal ampliada | OK | `placsp_agregadas.md` (`sindicacion_1044`) |
| 3. Conector estatal (discover + fetch) | OK | Minipasos 3.1–3.2; ver tabla abajo |
| 4. RAW + parse + normalize + upsert (estatal) | Parcial | 4.1–4.3 OK; siguientes 4.4–4.5 |
| 5. Workflow/job fuente estatal | — | Manual/controlado; secretos fuera del código |
| 6. Adaptador CSV genérico (o N/A) | N/A | Familia CSV no priorizada; reserva CSV → conector puntual |
| 7. Adaptador REST/Socrata (o N/A) | — | Motivado por `catalunya` (+ `euskadi` REST) |
| 8. CCAA propia #1 | — | Objetivo: `catalunya`; si bloqueo → siguiente de la cola |
| 9. CCAA propia #2 (+) | — | Objetivo: `euskadi`; si bloqueo → siguiente de la cola |
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
| 4.4 Upsert canónico + `source_sync` + trazabilidad | — | Unique `(placsp_agregadas, source_tender_id)`; reejecutar no duplica |
| 4.5 CLI / E2E local controlado | — | Fixture/dry-run; base para el Paso 5 (workflow) |

## Criterios transversales (cierre Semana 3)

| Ítem | Estado | Notas |
|---|---|---|
| Reejecutar no duplica (fuentes nuevas) | — | Unique `(source_code, source_tender_id)` |
| `source_sync` por cada fuente añadida | — | Status/contadores verificables |
| Tests en verde (parser / adaptadores / persistencia) | — | Incluir regresión PLACSP Semana 2 |
| ADRs estructurales (solo si hubo decisión nueva) | — | Si no → N/A |
| CHANGELOG actualizado | — | Ir actualizando por hito |

Cuando los pasos globales relevantes estén en OK → Semana 4 (cobertura territorial 17 CCAA + deduplicación).
