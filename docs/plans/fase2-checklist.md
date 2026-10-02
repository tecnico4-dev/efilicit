# Fase 2 / Semana 2 — checklist

Plan: [semana02-plan.md](semana02-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 2.

| Ítem | Estado | Notas |
|---|---|---|
| Documentación `docs/sources/placsp.md` | OK | Sindicación `643`; Atom/CODICE; sin scraping; menores/agregación fuera de alcance Semana 2 |
| `discover` PLACSP | OK | Paquetes mensuales ZIP vía URI conocidas; `artifact_key` estable; tests sin red |
| `fetch` (timeout, retry, tamaño, checksum) | OK | `httpx` + `tenacity`; budget de tamaño; SHA-256 determinista; tests sin red |
| RAW en Storage `raw` + `source_artifacts` | OK | `SupabaseStorageArtifactStore` + `fetch_validate_and_store_raw`; tests mock + integración local (skip sin Docker) |
| Parseo XML (`lxml`) + fixtures + tests | OK | Fixtures válido/incompleto/inesperado; ZIP+Atom; `source_record_id` documentado |
| Normalización + identidad organismos (NIF/CIF) | OK | `payload.canonical` + confidence HIGH/MEDIUM/LOW/UNRESOLVED; tests sobre fixtures |
| Upsert canónico (`tenders` / `tender_sources` / events / documents) | OK | `PostgresCanonicalRepository`; unique `(source_code, source_tender_id)` |
| Pipeline E2E puebla `tenders` con datos PLACSP | OK | CLI `run-placsp --fixture` → sync success + filas canónicas |
| Reejecutar no duplica | OK | Tests in-memory + Postgres: 2ª pasada → updated, 1 fila fuente |
| Trazabilidad licitación → artefacto RAW | OK | `source_artifacts.storage_path` + `tender_sources.artifact_id` en pipeline |
| `source_sync` refleja la ejecución | OK | status/contadores en corrida fixture local |
| Workflow `ingest-placsp.yml` | OK | Manual `workflow_dispatch`; default `dry-run`; cron comentado; secrets fuera del código |
| Tests parser / normalización / persistencia en verde | OK | Regresión Paso 10: `40 passed, 6 skipped` (integración local skip sin Docker) |
| ADRs estructurales (solo si hubo decisión nueva) | OK | [ADR 005](../adr/005-ingesta-actions-manual-first-cron-off.md) (cron off / manual-first); [ADR 006](../adr/006-raw-storage-httpx-sin-supabase-py.md) (Storage vía httpx) |
| CHANGELOG actualizado | OK | Unreleased con entradas Semana 2 |

Cuando esté en OK → Semana 3 (escalado estatal + primeras CCAA).

Verificación posterior con datos reales PLACSP (local): [docs/pruebas.md](../pruebas.md).
