# Fase 3 / Semana 3 — checklist

Plan: [semana03-plan.md](semana03-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 3.

| Ítem | Estado | Notas |
|---|---|---|
| Inventario priorizado (estatal + primeras CCAA) | — | Paso 1; cobertura/esfuerzo; sin inventar fuentes |
| Ficha `docs/sources/` fuente estatal ampliada | — | Menores / agregada / sindicación compatible según inventario |
| Conector estatal reutiliza contrato + pipeline | — | Preferir reuso PLACSP si compatible |
| RAW + `source_artifacts` + upsert canónico (estatal) | — | Idempotente; mismo modelo; sin DDL paralelo |
| Workflow/job fuente estatal | — | Manual/controlado; secretos fuera del código |
| Adaptador CSV genérico (o N/A documentado) | — | Solo si hay familia compatible real |
| Adaptador REST/Socrata (o N/A documentado) | — | Solo si corresponde a fuente priorizada |
| CCAA propia #1: docs + fixture + tests + sync + job | — | Datos reales o fixture representativo |
| CCAA propia #2 (+): docs + fixture + tests + sync + job | — | Criterio: varias CCAA propias |
| Catálogo `docs/sources/README.md` actualizado | — | Todas las fuentes Semana 3 listadas |
| Reejecutar no duplica (fuentes nuevas) | — | Unique `(source_code, source_tender_id)` |
| `source_sync` por cada fuente añadida | — | Status/contadores verificables |
| Tests en verde (parser / adaptadores / persistencia) | — | Incluir regresión PLACSP Semana 2 |
| ADRs estructurales (solo si hubo decisión nueva) | — | Si no → N/A |
| CHANGELOG actualizado | — | |

Cuando esté en OK → Semana 4 (cobertura territorial 17 CCAA + deduplicación).
