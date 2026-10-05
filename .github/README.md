# GitHub — EfiLicit

## CI

Workflow: [`.github/workflows/ci.yml`](workflows/ci.yml)

En cada push/PR a `main` ejecuta:

1. **Web lint / typecheck / build** — pnpm 10.33.0 + Node 24
2. **Ingestion CLI smoke** — Python 3.12 + uv + `cli --help` + pytest

Comprobar runs: https://github.com/tecnico4-dev/efilicit/actions

Tests de Postgres en ingestion se saltan si no hay DB ([ADR 004](../docs/adr/004-ci-ingestion-sin-postgres.md)).

## Ingesta PLACSP (Semanas 2–4)

Workflow: [`.github/workflows/ingest-placsp.yml`](workflows/ingest-placsp.yml)

- Disparo **manual** (`workflow_dispatch`). Cron **comentado** a propósito — [ADR 005](../docs/adr/005-ingesta-actions-manual-first-cron-off.md).
- Input **`syndication`**: `placsp` (perfiles, default), `placsp_agregadas` (estatal Semana 3) o `placsp_menores` (Semana 4).
- Modo por defecto: **`dry-run`** (fixture in-memory; no necesita secretos).
- Modos con escritura: `fixture-db` / `live` — exigen secrets y fallan si faltan.
- RAW a Storage (si `upload_storage=true`): API HTTP + `service_role` — [ADR 006](../docs/adr/006-raw-storage-httpx-sin-supabase-py.md).

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Postgres (fixture-db / live) |
| `SUPABASE_URL` | API Storage si `upload_storage=true` |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload RAW si `upload_storage=true` (solo proceso confiable) |

Comprobar: Actions → **Ingest PLACSP** → **Run workflow** → syndication + mode `dry-run`.

## Ingesta Catalunya (Semana 3)

Workflow: [`.github/workflows/ingest-catalunya.yml`](workflows/ingest-catalunya.yml)

- Disparo **manual** (`workflow_dispatch`). Cron **comentado** ([ADR 005](../docs/adr/005-ingesta-actions-manual-first-cron-off.md)).
- Modo por defecto: **`dry-run`** (fixture JSON in-memory; no necesita secretos).
- Modos con escritura: `fixture-db` / `live` — mismos secrets que PLACSP; en `live` acotar `max_pages`.

Comprobar: Actions → **Ingest Catalunya** → mode `dry-run`.

## Ingesta Euskadi (Semana 3)

Workflow: [`.github/workflows/ingest-euskadi.yml`](workflows/ingest-euskadi.yml)

- Disparo **manual** (`workflow_dispatch`). Cron **comentado** ([ADR 005](../docs/adr/005-ingesta-actions-manual-first-cron-off.md)).
- Modo por defecto: **`dry-run`** (fixture JSON in-memory).
- Modos con escritura: `fixture-db` / `live` — mismos secrets; en `live` acotar `max_pages` (API: 10 ítems/página).

Comprobar: Actions → **Ingest Euskadi** → mode `dry-run`.

## Alertas / digest (Semana 5)

Workflow: [`.github/workflows/alerts-digest.yml`](workflows/alerts-digest.yml)

- Disparo **manual** (`workflow_dispatch`). Cron **comentado** ([ADR 005](../docs/adr/005-ingesta-actions-manual-first-cron-off.md)).
- Envío Resend desde el **job Python** (no Edge Function) — [ADR 012](../docs/adr/012-digest-email-job-python-sin-edge-function.md).
- Frecuencias de cuenta `daily` \| `weekly` (`instant` fuera del MVP) — [ADR 013](../docs/adr/013-alert-frequencies-daily-weekly-instant-diferido.md).
- Modos:
  - **`dry-run`** (default): fixtures en memoria + `FakeEmailSender` (sin secretos).
  - **`write-fake`**: Postgres real + Fake (necesita `EFILICIT_DATABASE_URL`).
  - **`write-resend`**: Postgres + Resend real (necesita DB + `RESEND_API_KEY` + `ALERT_FROM_EMAIL`).

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Postgres (`write-*`) |
| `RESEND_API_KEY` | Solo `write-resend` |
| `ALERT_FROM_EMAIL` | Solo `write-resend` (remitente verificado en Resend) |

Comprobar: Actions → **Alerts digest** → mode `dry-run`.

## Protección de `main` — decisión del proyecto

**No se aplica** branch protection / ruleset sobre `main`, **al menos por ahora**. Decisión formal: [ADR 001](../docs/adr/001-proteccion-main-aplazada.md).

### Motivo

GitHub exige una cuenta de organización con plan de pago (**Team** o superior) para proteger ramas en un repositorio **privado**. EfiLicit es todavía un proyecto **pequeño y de prueba**: no se va a invertir en esa cuenta de pago solo para ese bloqueo.

### Qué sí queda en vigor

- El **CI** de Actions sigue activo y debe consultarse tras cambios relevantes.
- Disciplina manual recomendada: evitar force push y no borrar `main`.
- Push directo a `main` permitido durante esta fase.

Si en el futuro el proyecto crece o se dispone de plan Team / otro modelo de cuenta, se podrá reactivar la protección formal. Hasta entonces, **este requisito del setup se considera no aplicable** (aplazado a propósito).

<details>
<summary>Referencia (no usar por ahora): cómo se aplicaría la protection si el plan de GitHub lo permitiera</summary>

Usar **Add classic branch protection rule**:

1. Repo → **Settings** → **Branches** → **Add classic branch protection rule**
2. Pattern: `main`
3. Require status checks: `Web lint / typecheck / build`, `Ingestion CLI smoke`
4. Allow force pushes **desmarcado**; Allow deletions **desmarcado**
5. No exigir PR reviews mientras se quiera push directo en setup

</details>

## Environments / Secrets

Crear Environments (`preview`, `production`) cuando haga falta desplegar. **No** guardar secretos en el repo.

| Secret | Dónde / cuándo |
|---|---|
| `EFILICIT_DATABASE_URL` | Ingestas `fixture-db`/`live` y alertas `write-*` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Upload RAW en ingestas |
| `RESEND_API_KEY` / `ALERT_FROM_EMAIL` | Alertas `write-resend` |
| `SUPABASE_ACCESS_TOKEN` | Futuro (ops remotas) |
| Tokens Vercel | Cuando haya deploy |

Ahora mismo el **CI** (`ci.yml`) **no** necesita secretos.  
Los workflows de ingesta y alertas solo exigen secrets en modos con escritura o envío real.

## ADR

Catálogo: [`docs/adr/`](../docs/adr/README.md).
