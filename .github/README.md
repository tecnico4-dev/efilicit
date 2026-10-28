# GitHub — EfiLicit

## CI

Workflow: [`.github/workflows/ci.yml`](workflows/ci.yml)

En cada push/PR a `main` (y PRs en general) ejecuta:

1. **Web lint / typecheck / build** — pnpm 10.33.0 + Node 24
2. **Ingestion CLI smoke** — Python 3.12 + uv + `cli --help` + pytest

Comprobar runs: https://github.com/tecnico4-dev/efilicit/actions

Tests de Postgres en ingestion se saltan si no hay DB ([ADR 004](../docs/adr/004-ci-ingestion-sin-postgres.md)).

## Cron de producción (Semana 6 Paso 10)

Horarios **UTC**. El disparo manual (`workflow_dispatch`) sigue en **dry-run** por defecto.

**TEMP (prueba 2026-10-29, jueves madrugada)** — revertir a ADR 020 tras OK:

| Workflow | Cron TEMP (UTC) | Madrid (UTC+1) | En schedule |
|---|---|---|---|
| [ingest-placsp.yml](workflows/ingest-placsp.yml) | jue `02:00` | 03:00 | `live` ×3; Storage on |
| [ingest-catalunya.yml](workflows/ingest-catalunya.yml) | jue `04:00` | 05:00 | `live`, 10 páginas; Storage on |
| [ingest-euskadi.yml](workflows/ingest-euskadi.yml) | jue `05:00` | 06:00 | `live`, 10 páginas; Storage on |
| [alerts-match.yml](workflows/alerts-match.yml) | jue `06:00` | 07:00 | `--phase match` |
| [alerts-digest.yml](workflows/alerts-digest.yml) | jue `06:30` | 07:30 | `--phase send` + Resend |

Cadencia estable (ADR 020): ingestas lun 05–07; match lun 08:00; digest diario 09:00.

Requisito: secrets del repo configurados; si faltan, el job falla en el guard. Detalle: [ADR 020](../docs/adr/020-alertas-match-post-ingesta-y-digest-diario.md) · [ADR 005](../docs/adr/005-ingesta-actions-manual-first-cron-off.md).

## Ingesta PLACSP (Semanas 2–4)

Workflow: [`.github/workflows/ingest-placsp.yml`](workflows/ingest-placsp.yml)

- Disparo **manual** + **cron** (Paso 10).
- Input **`syndication`**: `placsp` / `placsp_agregadas` / `placsp_menores` (en cron se lanzan las tres).
- Modo manual por defecto: **`dry-run`**.
- RAW a Storage (si `upload_storage=true` o en cron): [ADR 006](../docs/adr/006-raw-storage-httpx-sin-supabase-py.md).

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Postgres (fixture-db / live) |
| `SUPABASE_URL` | API Storage si upload |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload RAW (solo proceso confiable) |

## Ingesta Catalunya / Euskadi

Mismo patrón: manual dry-run + cron live los lunes (ver tabla arriba).

## Alertas / match + digest (Semana 5+ / ADR 020)

| Workflow | Rol |
|---|---|
| [alerts-match.yml](workflows/alerts-match.yml) | Post-ingesta (lun): match → `notification_queue` |
| [alerts-digest.yml](workflows/alerts-digest.yml) | Diario: solo drenado → Resend |

- Ventana de match = `source_sync` success/partial del día + `tenders.updated_at` (no `since_days`, no `last_seen_at`).
- Envío Resend desde el **job Python** — [ADR 012](../docs/adr/012-digest-email-job-python-sin-edge-function.md).
- Frecuencias de cuenta `diaria` \| `semanal` — [ADR 013](../docs/adr/013-alert-frequencies-daily-weekly-instant-diferido.md).
- Decisión de cadencias: [ADR 020](../docs/adr/020-alertas-match-post-ingesta-y-digest-diario.md).

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Match `write` y digest `write-*` |
| `RESEND_API_KEY` | Digest `write-resend` / cron |
| `ALERT_FROM_EMAIL` | Remitente Resend |

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
| `EFILICIT_DATABASE_URL` | Ingestas `fixture-db`/`live`; alerts-match / alerts-digest `write*` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Upload RAW en ingestas (manual o cron) |
| `RESEND_API_KEY` / `ALERT_FROM_EMAIL` | Alerts-digest `write-resend` / cron diario |
| `SUPABASE_ACCESS_TOKEN` | Futuro (ops remotas) |
| Tokens Vercel | Cuando haya deploy |

Ahora mismo el **CI** (`ci.yml`) **no** necesita secretos.  
Los workflows de ingesta y alertas exigen secrets en modos con escritura, envío real o **schedule**.

## ADR

Catálogo: [`docs/adr/`](../docs/adr/README.md).
