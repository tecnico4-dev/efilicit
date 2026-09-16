# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
- Documento `docs/pruebas.md`: verificación local E2E de Semanas 0–2 con paquete mensual real PLACSP (RAW → canónico + idempotencia).
- Plan y checklist Semana 3 (`semana03-plan`, `fase3-checklist`): escalado estatal + primeras CCAA.
- Semana 3 Paso 1: inventario priorizado (estatal `placsp_agregadas` → `placsp_menores`; cola CCAA `catalunya` → `euskadi` + reservas).
- Semana 3 Paso 2: ficha `docs/sources/placsp_agregadas.md` (sindicación `1044`, Atom/CODICE, sin scraping).
- Semana 3 Paso 3.1: `PlacspSyndication` + discover parametrizado para `placsp_agregadas` (tests sin red).
- Semana 3 Paso 3.2: fetch `placsp_agregadas` reutiliza `download_bytes` (tests sin red sobre URL `sindicacion_1044`).
- Semana 3 Paso 4.1: validate + RAW Storage para `placsp_agregadas` (prefijo `raw/placsp_agregadas/`, tests sin red).
- Semana 3 Paso 4.2: parse Atom/CODICE para `placsp_agregadas` reutilizando el parser PLACSP (tests sin red).
- Semana 3 Paso 4.3: normalize + identidad para `placsp_agregadas` reutilizando etapas del pipeline común (tests sin red).

### Changed

- Decisión documentada: no aplicar branch protection en `main` por ahora (repo privado de prueba; no se contratará plan GitHub Team solo para ese bloqueo). Ver `.github/README.md`.
