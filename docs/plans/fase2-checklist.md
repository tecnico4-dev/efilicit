# Fase 2 / Semana 2 — checklist

Plan: [semana02-plan.md](semana02-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 2.

| Ítem | Estado | Notas |
|---|---|---|
| Documentación `docs/sources/placsp.md` | OK | Sindicación `643`; Atom/CODICE; sin scraping; menores/agregación fuera de alcance Semana 2 |
| `discover` PLACSP | OK | Paquetes mensuales ZIP vía URI conocidas; `artifact_key` estable; tests sin red |
| `fetch` (timeout, retry, tamaño, checksum) | — | |
| RAW en Storage `raw` + `source_artifacts` | — | |
| Parseo XML (`lxml`) + fixtures + tests | — | |
| Normalización + identidad organismos (NIF/CIF) | — | |
| Upsert canónico (`tenders` / `tender_sources` / events / documents) | — | |
| Pipeline E2E puebla `tenders` con datos PLACSP | — | |
| Reejecutar no duplica | — | |
| Trazabilidad licitación → artefacto RAW | — | |
| `source_sync` refleja la ejecución | — | |
| Workflow `ingest-placsp.yml` | — | |
| Tests parser / normalización / persistencia en verde | — | |
| ADRs estructurales (solo si hubo decisión nueva) | — | Si no → N/A |
| CHANGELOG actualizado | — | |

Cuando esté en OK → Semana 3 (escalado estatal + primeras CCAA).
