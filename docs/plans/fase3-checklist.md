# Fase 3 / Semana 3 — checklist

Plan: [semana03-plan.md](semana03-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 3.

| Ítem | Estado | Notas |
|---|---|---|
| Inventario priorizado (estatal + primeras CCAA) | OK | Estatal: agregadas→menores. CCAA cola: catalunya→euskadi + reservas (valencia, jcyl, canarias, asturias, …) |
| Ficha `docs/sources/` fuente estatal ampliada | OK | `placsp_agregadas.md` (`sindicacion_1044`); siguientes: conector Pasos 3–5 |
| Conector estatal reutiliza contrato + pipeline | Parcial | Discover+fetch `placsp_agregadas` OK; parse/pipeline RAW+upsert pendientes |
| RAW + `source_artifacts` + upsert canónico (estatal) | — | Idempotente; mismo modelo; sin DDL paralelo |
| Workflow/job fuente estatal | — | Manual/controlado; secretos fuera del código |
| Adaptador CSV genérico (o N/A documentado) | N/A | Familia CSV no priorizada; si la cola cae a reserva CSV → conector puntual |
| Adaptador REST/Socrata (o N/A documentado) | — | Motivado por `catalunya` (+ `euskadi` REST) |
| CCAA propia #1: docs + fixture + tests + sync + job | — | Objetivo: `catalunya`; si bloqueo → siguiente de la cola |
| CCAA propia #2 (+): docs + fixture + tests + sync + job | — | Objetivo: `euskadi`; si bloqueo → siguiente de la cola |
| Catálogo `docs/sources/README.md` actualizado | — | Todas las fuentes Semana 3 listadas |
| Reejecutar no duplica (fuentes nuevas) | — | Unique `(source_code, source_tender_id)` |
| `source_sync` por cada fuente añadida | — | Status/contadores verificables |
| Tests en verde (parser / adaptadores / persistencia) | — | Incluir regresión PLACSP Semana 2 |
| ADRs estructurales (solo si hubo decisión nueva) | — | Si no → N/A |
| CHANGELOG actualizado | — | |

Cuando esté en OK → Semana 4 (cobertura territorial 17 CCAA + deduplicación).
