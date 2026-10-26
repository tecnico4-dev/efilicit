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

| Workflow | Cron | En schedule |
|---|---|---|
| [ingest-placsp.yml](workflows/ingest-placsp.yml) | lun `05:00` | `live` × placsp / agregadas / menores; mes UTC actual; Storage on |
| [ingest-catalunya.yml](workflows/ingest-catalunya.yml) | lun `06:00` | `live`, 10 páginas; Storage on |
| [ingest-euskadi.yml](workflows/ingest-euskadi.yml) | lun `07:00` | `live`, 10 páginas; Storage on |
| [alerts-digest.yml](workflows/alerts-digest.yml) | diario `08:00` | `write-resend`, ventana 1 día |

Requisito: secrets del repo configurados; si faltan, el job falla en el guard. Detalle: [ADR 005](../docs/adr/005-ingesta-actions-manual-first-cron-off.md) (enmienda Paso 10).

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

## Alertas / digest (Semana 5+)

Workflow: [`.github/workflows/alerts-digest.yml`](workflows/alerts-digest.yml)

- Manual + cron diario 08:00 UTC `write-resend`.
- Envío Resend desde el **job Python** — [ADR 012](../docs/adr/012-digest-email-job-python-sin-edge-function.md).
- Frecuencias de cuenta `diaria` \| `semanal` — [ADR 013](../docs/adr/013-alert-frequencies-daily-weekly-instant-diferido.md).

| Secret | Uso |
|---|---|
| `EFILICIT_DATABASE_URL` | Postgres (`write-*`) |
| `RESEND_API_KEY` | `write-resend` / cron |
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
| `EFILICIT_DATABASE_URL` | Ingestas `fixture-db`/`live` y alertas `write-*` / cron |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Upload RAW en ingestas (manual o cron) |
| `RESEND_API_KEY` / `ALERT_FROM_EMAIL` | Alertas `write-resend` / cron diario |
| `SUPABASE_ACCESS_TOKEN` | Futuro (ops remotas) |
| Tokens Vercel | Cuando haya deploy |

Ahora mismo el **CI** (`ci.yml`) **no** necesita secretos.  
Los workflows de ingesta y alertas exigen secrets en modos con escritura, envío real o **schedule**.

## ADR

Catálogo: [`docs/adr/`](../docs/adr/README.md).
