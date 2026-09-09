# Semana 1 — Plan: modelo canónico + infraestructura de ingesta

> **Estado:** en curso (Pasos 1–6 hechos; siguiente = Paso 7 sync/artifacts en Postgres).  
> **Checklist:** [fase1-checklist.md](fase1-checklist.md)  
> **Precondición:** Fase 0 cerrada ([fase0-checklist.md](fase0-checklist.md)).  
> **Norma:** implementar lo ya fijado en `docs/00`–`04` y `.cursor/rules/`. ADR solo si hace falta cambiar arquitectura de verdad.

---

## Partimos de

Fase 0 hecha (entorno, Storage `raw`, CLI scaffold). Falta materializar el modelo canónico, los contratos de ingesta y que `source_sync` / `source_artifacts` funcionen. Sin PLACSP real (eso es Semana 2).

---

## Cómo lo hacemos

1. Seguir la lista de tablas y el contrato `SourceConnector` / pipeline de `docs/04` y `docs/01`.
2. DDL mínimo (columnas esenciales); ampliar en Semana 2 si PLACSP lo pide.
3. Sin catálogos `cpv` / `geography` completos en esta semana.
4. Stub/fake de conector solo para tests; no conector PLACSP.
5. Acceso DB en ETL con SQL directo (`psycopg` si hace falta), justificado en el PR; sin ORM ni infra nueva.
6. RLS según reglas ya escritas; `setup_rls_smoke` se mantiene.
7. Pasos pequeños y verificables; push a remoto solo con OK explícito.
8. ADR solo si surge un cambio estructural real; si no, checklist en `N/A`.

---

## Pasos

### 1. Migración operativa

Tablas: `source_sync`, `source_artifacts`, `errors` (campos de sync según esbozo en `docs/00`). Índices básicos + RLS/grants.

**Listo cuando:** `supabase db reset` local OK.

### 2. Migración canónica

Tablas: `contracting_authorities`, `suppliers`, `tenders`, `tender_sources`, `tender_events`, `documents`. Unique por fuente + id en fuente; identidad fiscal nullable (NIF/CIF cuando exista).

**Listo cuando:** `db reset` OK; FKs e uniques correctos.

### 3. Esqueleto usuarios / alertas

Tablas: `users` (ligado a `auth.users`), `saved_searches`, `alerts`, `notification_queue` (con `idempotency_key`). RLS owner-only.

**Listo cuando:** `db reset` OK; seed Alice/Bob intacto.

### 4. Tipos + CHANGELOG

Regenerar `packages/types` desde Supabase local; anotar el cambio en `CHANGELOG.md`.

**Listo cuando:** `pnpm -r typecheck` verde.

### 5. `SourceConnector` en código

Protocol `discover` / `fetch` / `parse` (como en `docs/01`), modelos Pydantic, stub sin red.

**Listo cuando:** tests básicos del contrato en verde.

### 6. Pipeline común mínimo

Etapas del roadmap como módulos invocables. Pass-through donde aún no hay dominio; sí cablear sync/artifacts y `store_raw` mínimo (ruta + checksum).

**Listo cuando:** test mínimo del runner con stub.

### 7. Sync + artifacts funcionando

Abrir/cerrar run, registrar artifact + checksum, contadores; reejecutar el stub sin corromper datos.

**Listo cuando:** prueba contra Postgres local OK.

### 8. Tests + CI

`pytest` en ingestion; CI ejecuta `uv run pytest` además del smoke `--help`.

**Listo cuando:** local + CI en verde.

### 9. Cierre

Marcar [fase1-checklist.md](fase1-checklist.md). ADR solo si en los pasos anteriores hubo decisión estructural nueva.

**Fuera de alcance:** PLACSP real, workflows `ingest-*.yml`, dedup, FTS, Auth UI, Resend.

---

## Decisiones durante la ejecución

Registro de lo acordado al cerrar (o antes de) cada paso:

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio Semana 1 | Ejecutar **paso a paso** con revisión | Igual que Semana 0 |
| Plan | Sin ADRs previos; ADR solo si hay cambio estructural | Respetar arquitectura ya fijada |
| Paso 1 | Tres tablas operativas en migración propia; RLS sin grants a anon/authenticated | Bitácora ETL antes del modelo canónico; solo service_role escribe |
| Paso 1 | Unique `(source_code, run_id)` y `(source_code, artifact_key)` / checksum | Base de idempotencia y trazabilidad |
| Paso 2 | DDL canónico mínimo + SELECT público (anon/authenticated); escritura solo service_role | Datos de contratación son públicos; ETL no usa el frontend |
| Paso 2 | Unique parcial `(tax_id_country, tax_id)` en organismos/suppliers | Identidad fiscal cuando existe; sin forzar si falta |
| Paso 3 | Esqueleto users/alertas/cola con RLS owner-only | Reserva sitio para Semana 5 sin lógica de producto aún |
| Paso 4 | Regenerar `database.types.ts` desde esquema local | Frontend tipado alineado con migraciones Semana 1 |
| Paso 5 | `SourceConnector` + stub + tests de contrato | Contrato de `docs/01` bajado a código; sin red |
| Paso 6 | Pipeline común + runner in-memory | Etapas del roadmap; store_raw con checksum; DB real en Paso 7 |

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 1  
- [docs/01-arquitectura-fija.md](../01-arquitectura-fija.md) §§ 5–8  
- [fase1-checklist.md](fase1-checklist.md) · [semana00-plan.md](semana00-plan.md)
