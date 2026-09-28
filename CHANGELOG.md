# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Semana 5 Paso 2: FTS en `tenders` (`search_vector` generated spanish A/B, GIN) + `pg_trgm` en `title`; tipos TS regenerados.
- Semana 5 Paso 1: contrato `criteria` v1 compartido para `alerts` / `saved_searches` (`packages/types/src/criteria.ts`, `efilicit_ingestion.alerts.criteria`) + comments SQL; sin DDL de columnas nuevas.
- Plan y checklist Semana 5 (`semana05-plan`, `fase5-checklist`): búsqueda + Auth + alertas; rama `tecnico4/semana-05`.
- Plan y checklist Semana 4 (`semana04-plan`, `fase4-checklist`): cobertura territorial 17 CCAA + deduplicación; leftover `placsp_menores`; rama `tecnico4/semana-04`.
- Semana 4 Paso 1: cobertura 17 CCAA en `docs/sources/cobertura-ccaa.md` (2 propias + 5 agregación + 10 perfiles alojados `placsp`); ficha `placsp_menores.md`; 0 CCAA propias extra. Plan sin duplicar fichas (solo decisiones breves).
- Semana 4 Paso 2.2: `PLACSP_MENORES` (`sindicacion_1143`) en discover/fetch con tests sin red.
- Semana 4 Paso 2.3: RAW Storage `raw/placsp_menores/`, parse/normalize/upsert canónico e idempotente para menores (tests sin red).
- Semana 4 Paso 2.4: CLI `run-placsp --syndication placsp_menores` + workflow `ingest-placsp.yml` (dry-run default, cron off).
- Semana 4 Paso 4: migración `tender_sources` con `match_method`, `match_score`, `matched_at`, `review_status` (`unmatched`/`auto`/`pending`); tipos TS regenerados.
- Semana 4 Paso 5: matching multi-fuente en pipeline (`stages.deduplicate` + `MatchLookup`); anota `payload['match']` (`auto`/`pending`/`unmatched`); tests sin red.
- Semana 4 Paso 6: upsert respeta matching (`auto` reutiliza `tenders.id`; `pending`/`unmatched` crean fila; idempotente en `(source_code, source_tender_id)`).
- Semana 4 Paso 7: fixtures de solape PLACSP↔Euskadi (`fixtures/overlap/`) + tests de auto-merge / no-merge / regresión Catalunya sin NIF; batería ingestion en verde.
- Cierre Semana 4: checklist Fase 4 completo; catálogo de fuentes actualizado; cobertura 17 CCAA + `placsp_menores` + dedup multi-fuente; sin ADR nuevo (N/A — se implementó la arquitectura ya fijada). Siguiente: Semana 5 (búsqueda + Auth + alertas).
- Documentación base de onboarding, arquitectura, setup, reglas Cursor y roadmap MVP.
- Cimientos del monorepo: `.gitignore`, `.env.example`, `package.json`, `pnpm-workspace.yaml`, árbol de carpetas y guías `README` / `CONTRIBUTING`.
- Reglas Cursor en `.cursor/rules/` (`00`–`08`) según `docs/03-reglas-cursor.md`.
- Scaffold frontend `@efilicit/web` (Next.js + TypeScript + Tailwind) y paquete `@efilicit/types`.
- Scaffold Python `@efilicit` ingestion (`efilicit_ingestion` CLI mínimo con `uv`).
- Inicialización de `supabase/` y stack local (Docker) para desarrollo.
- Workflow CI mínimo en GitHub Actions (lint/typecheck/build web + smoke CLI ingestion).
- Migración local Fase 0: bucket Storage `raw` + tabla RLS smoke `setup_rls_smoke` + seed sintético (Alice/Bob).
- Proyecto Supabase remoto EfiLicit vinculado (`luvxqyajujlznocflymo`); major PostgreSQL 17 alineada; migración Fase 0 aplicada en remoto.
- Cierre Fase 0: `.env.local` web, tipos generados, checklist de Fase 0, smoke de consulta a Supabase local.
- Carpeta `docs/plans/`: planes y checklists por semana (`semana00-plan`, `semana01-plan`, `fase0-checklist` movido desde `docs/`, `fase1-checklist`).
- Migración Semana 1 (Paso 1): tablas operativas `source_sync`, `source_artifacts`, `errors` con RLS restringido a procesos confiables.
- Migración Semana 1 (Paso 2): núcleo canónico mínimo (`tenders`, `tender_sources`, `tender_events`, `contracting_authorities`, `suppliers`, `documents`) con lectura pública y escritura ETL.
- Migración Semana 1 (Paso 3): esqueleto `users`, `saved_searches`, `alerts`, `notification_queue` con RLS por propietario.
- Tipos TypeScript regenerados desde Supabase local tras el esquema Semana 1 (Pasos 1–3).
- Contrato Python `SourceConnector` (`discover` / `fetch` / `parse`), modelos Pydantic y stub con tests de contrato.
- Pipeline común mínimo (`run_pipeline`) con etapas del roadmap, `store_raw` (checksum + path) y prueba con stub in-memory.
- Persistencia Postgres de `source_sync` / `source_artifacts` vía `psycopg` (cliente SQL de ETL) + tests de integración locales.
- CI de ingestion: además del smoke `--help`, ejecuta `pytest` (`uv sync --extra dev`).
- Cierre Semana 1: checklist completo; sin ADR nuevo (N/A — se implementó la arquitectura ya fijada).
- Plan y checklist Semana 2 (`semana02-plan`, `fase2-checklist`): PLACSP vertical slice.
- Catálogo de fuentes: ficha `docs/sources/placsp.md` (sindicación `643`, Atom/CODICE, acceso Open Data sin scraping).
- Conector PLACSP `discover`: paquetes mensuales ZIP por URI conocidas, `artifact_key` estable y tests sin red.
- Conector PLACSP `fetch`: timeout, reintentos (`tenacity`), límite de tamaño y checksum SHA-256 determinista.
- Persistencia RAW: `SupabaseStorageArtifactStore` (bucket `raw`) + registro en `source_artifacts` vía `fetch_validate_and_store_raw`.
- Parser PLACSP Atom/CODICE (`lxml`) con fixtures anonimizadas y `source_record_id` estable documentado.
- Normalización canónica + identidad de organismos (`identity_confidence` con NIF/CIF prioritario).
- Upsert canónico en Postgres (`tenders`, `tender_sources`, `tender_events`, `documents`) con reejecución idempotente.
- CLI `run-placsp`: pipeline PLACSP E2E local con `--fixture` / `--dry-run` (y escritura a Supabase local).
- Workflow GitHub Actions `ingest-placsp.yml`: ingesta PLACSP manual (`dry-run` / `fixture-db` / `live`); cron desactivado; secretos fuera del código.
- Cierre Semana 2: checklist Fase 2 completo; sin ADR nuevo (N/A — se implementó la arquitectura ya fijada).
- Documento `docs/pruebas.md`: verificación local E2E con datos reales — `placsp` (Semana 2), `placsp_agregadas`, `catalunya` (8.6) y `euskadi` (9.5); RAW → canónico + idempotencia.
- Semana 3 Paso 8.6: verificación live SODA `catalunya` (1 página × 1000 + idempotencia) documentada en `docs/pruebas.md` Parte C.
- Semana 3 Paso 9.5: verificación live API `euskadi` (1 página × 10 + idempotencia) documentada en `docs/pruebas.md` Parte D.
- Plan y checklist Semana 3 (`semana03-plan`, `fase3-checklist`): escalado estatal + primeras CCAA.
- Semana 3 Paso 1: inventario priorizado (estatal `placsp_agregadas` → `placsp_menores`; cola CCAA `catalunya` → `euskadi` + reservas).
- Semana 3 Paso 2: ficha `docs/sources/placsp_agregadas.md` (sindicación `1044`, Atom/CODICE, sin scraping).
- Semana 3 Paso 3.1: `PlacspSyndication` + discover parametrizado para `placsp_agregadas` (tests sin red).
- Semana 3 Paso 3.2: fetch `placsp_agregadas` reutiliza `download_bytes` (tests sin red sobre URL `sindicacion_1044`).
- Semana 3 Paso 4.1: validate + RAW Storage para `placsp_agregadas` (prefijo `raw/placsp_agregadas/`, tests sin red).
- Semana 3 Paso 4.2: parse Atom/CODICE para `placsp_agregadas` reutilizando el parser PLACSP (tests sin red).
- Semana 3 Paso 4.3: normalize + identidad para `placsp_agregadas` reutilizando etapas del pipeline común (tests sin red).
- Semana 3 Paso 4.4: upsert canónico + `source_sync` + trazabilidad para `placsp_agregadas` (idempotente; tests sin red + Postgres opcional).
- Semana 3 Paso 4.5: CLI `run-placsp --syndication placsp_agregadas` con `--fixture` / `--dry-run` (E2E local sin red PLACSP).
- Semana 3 Paso 5: workflow `ingest-placsp.yml` admite `syndication=placsp_agregadas` (manual, dry-run por defecto, cron off).
- Semana 3 Paso 7: adaptador REST/Socrata (`SocrataConnector`) + preset `catalunya` (`ybgg-dgi6`); ficha y tests sin red.
- Semana 3 Paso 8.1: ficha `docs/sources/catalunya.md` ampliada al alcance E2E CCAA #1 (minipasos 8.2–8.5).
- Semana 3 Paso 8.2: validate + RAW Storage para `catalunya` (prefijo `raw/catalunya/`, tests sin red).
- Semana 3 Paso 8.3: upsert canónico + `source_sync` + trazabilidad para `catalunya` (idempotente; tests sin red + Postgres opcional).
- Semana 3 Paso 8.4: CLI `run-catalunya` con `--fixture` / `--dry-run` (E2E local sin red SODA).
- Semana 3 Paso 8.5: workflow `ingest-catalunya.yml` (manual, dry-run por defecto, cron off).
- Semana 3 Paso 9: CCAA #2 `euskadi` — conector KontratazioA REST (`contracting-notices`), ficha, RAW `raw/euskadi/`, CLI `run-euskadi`, workflow `ingest-euskadi.yml`, tests sin red; live en Paso 9.5 / `docs/pruebas.md` Parte D.
- Cierre Semana 3: checklist Fase 3 completo; catálogo de fuentes homogeneizado; regresión ingestion `112 passed`; sin ADR nuevo (N/A — se implementó la arquitectura ya fijada). `placsp_menores` y resto de CCAA → Semana 4+.

### Changed

- Semana 4 (ajuste tras pruebas live): el matching en `tender_sources` ahora persiste `match_candidate_tender_id` — candidato best cuando `review_status=pending` (Studio / revisión humana futura); `auto`/`unmatched` → null; re-ingesta actualiza el best si sigue `pending`. Evolución prevista: tabla `match_suggestions` (N candidatos) cuando exista UI de revisión.
- Decisión documentada: no aplicar branch protection en `main` por ahora (repo privado de prueba; no se contratará plan GitHub Team solo para ese bloqueo). Ver `.github/README.md`.
