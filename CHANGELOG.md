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

### Changed

- Decisión documentada: no aplicar branch protection en `main` por ahora (repo privado de prueba; no se contratará plan GitHub Team solo para ese bloqueo). Ver `.github/README.md`.
