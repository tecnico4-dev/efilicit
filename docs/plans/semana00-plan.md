# Semana 0 / Fase 0 — Plan de setup del entorno

> **Estado:** cerrado (ver [fase0-checklist.md](fase0-checklist.md)).  
> **Origen:** plan acordado al inicio de la Fase 0 a partir de `docs/02-setup-entorno.md` y Semana 0 de `docs/04-roadmap-mvp.md`.  
> **Propósito:** dejar constancia del orden de trabajo y de las decisiones tomadas **antes** de cada paso siguiente.

---

## Objetivo

Entorno funcional, monorepo vivo, Supabase reproducible (local + remoto vinculado), migraciones controladas, web en blanco, CLI de ingesta con `--help`, reglas Cursor y documentación de contribución. **Sin** modelo canónico ni conectores reales (eso es Semana 1+).

---

## Estado al arrancar (resumen)

Solo existían el repo Git y la documentación base (`docs/00`–`04`). Faltaba el monorepo, Supabase, CI, scaffolds web/Python y el resto del setup.

---

## Orden de trabajo acordado

### Paso 0 — Inventario de herramientas (solo lectura)

Comprobar Git, Docker (daemon + RAM práctica), Node, pnpm, Python 3.12, uv, Supabase CLI. Sin crear archivos de app.

### Paso 1 — Cimientos del repo

`.gitignore`, `.env.example`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `package.json` (engines + packageManager), `pnpm-workspace.yaml`, árbol de carpetas (`apps/`, `packages/`, `ingestion/`, `docs/adr|sources|runbooks/`, `.github/`, `.cursor/`).

### Paso 2 — Reglas Cursor

Crear `.cursor/rules/00`–`08` según el contenido nuclear de `docs/03-reglas-cursor.md`.

### Paso 3 — Scaffold frontend

`apps/web/` (Next.js + TS + Tailwind) en blanco; `packages/types/` preparado para tipos generados.

### Paso 4 — Scaffold ingesta Python

`ingestion/` con `uv`, Python 3.12, CLI `efilicit_ingestion` que responde `--help`. Sin conectores.

### Paso 5 — Supabase local (init)

`supabase init`, `supabase start` / `status` / Studio. Validar Docker antes del link remoto si hace falta.

### Paso 6 — GitHub + CI mínimo

Workflow CI (lint/typecheck/build web + smoke CLI). Environments/Secrets según necesidad. Protección de `main` prevista por la doc.

### Paso 7 — Supabase remoto (captura / sincronización)

`login` → `link` → capturar o alinear historial de migraciones; major PostgreSQL local = remoto. **No** `db reset --linked`. Trabajo diario en local.

### Paso 8 — Storage RAW + seed + RLS smoke

Bucket `raw` privado; `seed.sql` sintético; tabla smoke RLS; `supabase db reset` **solo local**.

### Paso 9 — Cierre reproducible

`.env.local` → Supabase local; `pnpm dev`; tipos TS generados; checklist de cierre Fase 0.

---

## Decisiones durante la ejecución

Registro de lo acordado **antes** de seguir (o al cerrar un paso), en orden cronológico aproximado:

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio | Ejecutar Fase 0 **paso a paso** con OK explícito | Evitar cambios masivos sin revisión |
| Paso 1 | Fijar Node **24.x** y pnpm **10.33.0** en el repo | Versiones reales de la máquina al bootstrap |
| Paso 0 | Ubuntu WSL2 **opcional**; continuar en PowerShell | Reduce fricción pero no es requisito |
| Paso 6 | CI mínimo en GitHub Actions | Cumplir checklist sin orquestar ETL aún |
| Paso 6 → cierre | **No activar branch protection en `main`** | Límite de cuenta GitHub Free en repo privado; [ADR 001](../adr/001-proteccion-main-aplazada.md); detalle en `.github/README.md` |
| Paso 7 | Remoto vacío al vincular → historial alineado con migración Fase 0 vía `db push` controlado (no pull de esquema productivo ajeno) | Remoto nuevo / greenfield; [ADR 002](../adr/002-bootstrap-supabase-remoto-greenfield.md) |
| Paso 8 | Migración propia Storage `raw` + `setup_rls_smoke` (no modelo canónico) | Probar Storage/RLS sin adelantar Semana 1 |
| Paso 9 | Checklist en `docs/fase0-checklist.md` (luego movido a `docs/plans/`) | Constancia de cierre |

---

## Criterio de cierre (cumplido)

Entorno local reproducible, monorepo vivo, Supabase local OK, remoto vinculado y esquema alineado, sin tocar producción a mano como hábito, web en blanco, CLI `--help`, reglas Cursor, changelog/contribución en sitio. Desarrollo de modelo canónico e ingesta real → **Semana 1** ([semana01-plan.md](semana01-plan.md)).

## Referencias

- [docs/02-setup-entorno.md](../02-setup-entorno.md)
- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 0
- [fase0-checklist.md](fase0-checklist.md)
- Reconstruido a partir del plan y las decisiones de la sesión de setup de Semana 0 / Fase 0.
