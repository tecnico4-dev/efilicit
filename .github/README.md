# GitHub — EfiLicit

## CI

Workflow: [`.github/workflows/ci.yml`](workflows/ci.yml)

En cada push/PR a `main` (y PRs en general) ejecuta:

1. **Web lint / typecheck / build** — pnpm 10.33.0 + Node 24
2. **Ingestion CLI smoke** — Python 3.12 + uv + `cli --help` + pytest

Comprobar runs: https://github.com/tecnico4-dev/efilicit/actions

Tests de Postgres en ingestion se saltan si no hay DB ([ADR 004](../docs/adr/004-ci-ingestion-sin-postgres.md)).

## Cadencia de producción (ADR 020)

El **trabajo** corre en GitHub Actions (`workflow_dispatch` + secrets). El **despertador** es un cron externo → API dispatch — **sin** `on.schedule` en ingest/alertas.

Runbook: [docs/runbooks/external-cron-dispatch.md](../docs/runbooks/external-cron-dispatch.md) · script: [`scripts/dispatch-workflow.sh`](../scripts/dispatch-workflow.sh).

Horarios de producto **UTC** (configurar en el servicio externo):

| Workflow | Cadencia estable (UTC) | Inputs productivos |
|---|---|---|
| [ingest-placsp.yml](workflows/ingest-placsp.yml) ×3 | lun 05:00 | `mode=live`, `upload_storage=true`; un job por `syndication` |
| [ingest-catalunya.yml](workflows/ingest-catalunya.yml) | (cron externo) | `live`, `since_days=7`, `max_pages=20`, Storage on |
| [ingest-euskadi.yml](workflows/ingest-euskadi.yml) | (cron externo) | `live`, `max_pages=30`, Storage on |
| [alerts-match.yml](workflows/alerts-match.yml) | lun 08:00 | `mode=write` (`--phase match`) |
| [alerts-digest.yml](workflows/alerts-digest.yml) | diario 09:00 | `mode=write-resend` (`--phase send`) |

Disparo manual desde la UI de Actions: **dry-run** por defecto. Sin secrets, los modos write fallan en el guard.

Detalle: [ADR 020](../docs/adr/020-alertas-match-post-ingesta-y-digest-diario.md) · [ADR 005](../docs/adr/005-ingesta-actions-manual-first-cron-off.md).

## Ingesta PLACSP (Semanas 2–4)

Workflow: [`.github/workflows/ingest-placsp.yml`](workflows/ingest-placsp.yml)

- Disparo **`workflow_dispatch`** (manual o cron externo).
- Input **`syndication`**: `placsp` / `placsp_agregadas` / `placsp_menores` (tres jobs externos en cadencia productiva).
- Modo manual por defecto: **`dry-run`**.
- RAW a Storage (si `upload_storage=true`): [ADR 006](../docs/adr/006-raw-storage-httpx-sin-supabase-py.md).

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Postgres (fixture-db / live) |
| `SUPABASE_URL` | API Storage si upload |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload RAW (solo proceso confiable) |

## Ingesta Catalunya / Euskadi

Mismo patrón: manual dry-run + dispatch productivo vía cron externo (tabla arriba).

## Cleanup orphan RAW (Storage)

Workflow: [`.github/workflows/cleanup-orphans.yml`](workflows/cleanup-orphans.yml)  
Script: [`scripts/borrar_huerfanos.py`](../scripts/borrar_huerfanos.py)

- Disparo **solo manual** (`workflow_dispatch`). Sin cron por ahora.
- Default: **`dry-run`** (lista + CSV artifact). Input **`apply`** borra de verdad.
- Huérfano = objeto en bucket `raw` sin fila en `source_artifacts` y más antiguo que `min_age_hours` (24).
- **No** lanzar mientras corre una ingesta.
- Tras `apply` en producción: conviene `VACUUM (FULL) storage.objects;` en SQL Editor.

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Listar / recheck huérfanos |
| `SUPABASE_URL` | API Storage (`apply`) |
| `SUPABASE_SERVICE_ROLE_KEY` | DELETE Storage (`apply`) |

Para probar desde una rama de trabajo: Actions → Cleanup orphan RAW → Run workflow → elige esa rama.

## Cleanup tenders (retención / ADR 031)

Workflow: [`.github/workflows/cleanup-tenders.yml`](workflows/cleanup-tenders.yml)  
Script: [`scripts/purge_tenders.py`](../scripts/purge_tenders.py) · ADR: [031](../docs/adr/031-retencion-purge-tenders.md)

- Disparo **solo manual**. Default **`dry-run`**; **`apply`** borra.
- Include: `min_deadline_age_months` (default 3), `source_code` opcional (vacío = todas), `limit` opcional.
- Escudos (skip total): Mis licitaciones, favoritos personales/común, valoraciones, alerta viva (papelera 30d protege; dismiss permanente no), abierta/`deadline` null o futuro.
- Tras borrar: poda `notification_emails.tender_ids` / `tender_count`; RAW solo si el artifact queda sin refs.
- **No** lanzar durante ingesta. Workflows nuevos pueden no listarse en Actions hasta pasar por `main`.

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Candidatas / escudos / DELETE |
| `SUPABASE_URL` | API Storage (`apply`) |
| `SUPABASE_SERVICE_ROLE_KEY` | DELETE Storage (`apply`) |

## Alertas / match + digest (Semana 5+ / ADR 020)

| Workflow | Rol |
|---|---|
| [alerts-match.yml](workflows/alerts-match.yml) | Post-ingesta (lun): match → `notification_queue` |
| [alerts-digest.yml](workflows/alerts-digest.yml) | Diario: solo drenado → Resend |

- Ventana de match = `source_sync` success/partial del día + `tenders.updated_at` (no `since_days`, no `last_seen_at`).
- Envío Resend desde el **job Python** — [ADR 012](../docs/adr/012-digest-email-job-python-sin-edge-function.md).
- Frecuencias de cuenta `diaria` \| `semanal` — [ADR 013](../docs/adr/013-alert-frequencies-daily-weekly-instant-diferido.md).
- Orquestación + cadencias: [ADR 020](../docs/adr/020-alertas-match-post-ingesta-y-digest-diario.md).

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Match `write` y digest `write-*` |
| `RESEND_API_KEY` | Digest `write-resend` / dispatch productivo |
| `ALERT_FROM_EMAIL` | Remitente Resend |
| `EFILICIT_APP_URL` (variable) | Base de la web en enlaces del digest (ficha, buzón, cuenta) |

## Protección de `main`

**Activa** (repo público + GitHub Free). Historia del aplazamiento y reactivación: [ADR 001](../docs/adr/001-proteccion-main-aplazada.md).

### Rule classic (Settings → Branches → `main`)

1. **Require a pull request before merging** — no push directo de commits nuevos a `main`; hay que mergear desde otra rama vía PR.
2. **Require status checks to pass before merging** + **Require branches to be up to date before merging**:
   - `Web lint / typecheck / build`
   - `Ingestion CLI + pytest`
3. **Allow force pushes** y **Allow deletions** desmarcados.

El CI (`.github/workflows/ci.yml`) sigue siendo la comprobación automática; los nombres de check deben coincidir con los `name:` de los jobs del workflow.

## Environments / Secrets

Crear Environments (`preview`, `production`) cuando haga falta desplegar. **No** guardar secretos en el repo.

| Secret | Dónde / cuándo |
|---|---|
| `EFILICIT_DATABASE_URL` | Ingestas `fixture-db`/`live`; alerts-match / alerts-digest `write*` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Upload RAW en ingestas |
| `RESEND_API_KEY` / `ALERT_FROM_EMAIL` | Alerts-digest `write-resend` |
| `EFILICIT_APP_URL` (variable) | Enlaces del HTML del digest |
| `SUPABASE_ACCESS_TOKEN` | Futuro (ops remotas) |
| Tokens Vercel | Cuando haya deploy |
| PAT del despertador | **Fuera del repo** (cron-job.org u otro); no es secret de Actions |

Ahora mismo el **CI** (`ci.yml`) **no** necesita secretos.  
Los workflows de ingesta y alertas exigen secrets del repo en modos con escritura o envío real. El PAT del cron externo vive solo en el servicio despertador.

## ADR

Catálogo: [`docs/adr/`](../docs/adr/README.md).
