# ingestion/

Motor ETL de EfiLicit (Python 3.12 + uv).

## Setup

```powershell
cd ingestion
uv sync
uv run python -c "import sys; print(sys.version)"
uv run python -m efilicit_ingestion.cli --help
```

## Estado

PLACSP cableado en CLI (`run-placsp`): perfiles (`placsp`), agregadas (`placsp_agregadas`)
y menores (`placsp_menores`) vía `--syndication`.  
Catalunya Socrata: `run-catalunya` (Semana 3 Paso 8).  
Euskadi KontratazioA: `run-euskadi` (Semana 3 Paso 9).

`discover` → `fetch` → RAW → `parse` → normalize/identidad → upsert canónico.

## Alertas (Semana 5)

- Matching batch → cola: `efilicit_ingestion.alerts` (`run_alert_batch`).
- Digest diario (Paso 8): `drain_daily_digests` + `FakeEmailSender` (tests) /
  `ResendEmailSender` (`RESEND_API_KEY`, `ALERT_FROM_EMAIL` solo en entorno).
- CLI/workflow de producción: Paso 9.

```powershell
uv run pytest tests/test_alert_match.py tests/test_alert_batch.py tests/test_alert_digest.py -q
```

### Smoke Resend real (opcional)

Necesitas cuenta en [resend.com](https://resend.com/), API key y un `from` válido.
Con el dominio de prueba de Resend (`onboarding@resend.dev`) solo puedes enviarte
email a la dirección de tu cuenta Resend.

```powershell
cd ingestion
$env:RESEND_API_KEY="re_..."
$env:ALERT_FROM_EMAIL="EfiLicit <onboarding@resend.dev>"
$env:ALERT_TO_EMAIL="tu-email-de-la-cuenta-resend@..."
uv run python -m efilicit_ingestion.alerts.smoke_resend
```

Esperado: `Resend OK — provider_id=...` y el correo en tu bandeja.
Sin esas variables el script **no** finge éxito (exit 2).

## Corrida E2E local

### Dry-run perfiles (sin escribir DB)

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --dry-run `
  --as-of 2026-09-11
```

Esperado: `status=success`, `source_code=placsp`, `records_seen=1`, `raw_path=raw/placsp/...`.

### Dry-run agregadas (Semana 3 Paso 4.5)

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --syndication placsp_agregadas `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --dry-run `
  --as-of 2026-09-15
```

Esperado: `status=success`, `source_code=placsp_agregadas`, `raw_path=raw/placsp_agregadas/...`.

### Dry-run menores (Semana 4 Paso 2.4)

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --syndication placsp_menores `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --dry-run `
  --as-of 2026-09-17
```

Esperado: `status=success`, `source_code=placsp_menores`, `raw_path=raw/placsp_menores/...`.

### Dry-run Catalunya (Semana 3 Paso 8.4)

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-catalunya `
  --fixture tests/fixtures/catalunya/valid_page.json `
  --dry-run
```

Esperado: `status=success`, `source_code=catalunya`, `records_seen=2`, `raw_path=raw/catalunya/...`.

### Dry-run Euskadi (Semana 3 Paso 9)

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-euskadi `
  --fixture tests/fixtures/euskadi/valid_page.json `
  --dry-run
```

Esperado: `status=success`, `source_code=euskadi`, `records_seen=2`, `raw_path=raw/euskadi/...`.

### Contra Supabase local (Studio)

Con Docker + `supabase start`:

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --no-storage `
  --as-of 2026-09-11 `
  --run-id demo-placsp-1
```

Agregadas (mismo fixture CODICE; distinto `source_code`):

```powershell
uv run python -m efilicit_ingestion.cli run-placsp `
  --syndication placsp_agregadas `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --no-storage `
  --as-of 2026-09-15 `
  --run-id demo-agregadas-1
```

Catalunya:

```powershell
uv run python -m efilicit_ingestion.cli run-catalunya `
  --fixture tests/fixtures/catalunya/valid_page.json `
  --no-storage `
  --run-id demo-catalunya-1
```

Euskadi:

```powershell
uv run python -m efilicit_ingestion.cli run-euskadi `
  --fixture tests/fixtures/euskadi/valid_page.json `
  --no-storage `
  --run-id demo-euskadi-1
```

(`--no-storage` evita depender de la service_role; añade Storage omitiendo ese flag si tienes `SUPABASE_SERVICE_ROLE_KEY`.)

Luego en Studio (`http://127.0.0.1:54323`):

1. `source_sync` → `run_id` indicado, status `success`
2. `source_artifacts` → path/checksum del ZIP fixture
3. `tenders` / `tender_sources` → licitación fixture (`source_code` = `placsp` o `placsp_agregadas`)
4. Reejecutar el mismo comando con otro `--run-id` → no duplica `tender_sources`

### Live PLACSP (opcional, red real)

```powershell
uv run python -m efilicit_ingestion.cli run-placsp --from-month 2026-09 --to-month 2026-09
```

Solo cuando quieras probar descarga oficial (ZIPs pueden ser grandes).

## GitHub Actions

Workflow: [`.github/workflows/ingest-placsp.yml`](../.github/workflows/ingest-placsp.yml)

1. Repo → **Actions** → **Ingest PLACSP** → **Run workflow**.
2. Elige **syndication** (`placsp` o `placsp_agregadas`) y mode **`dry-run`** (sin secretos).
3. Para escribir en un entorno remoto: configura secrets (`EFILICIT_DATABASE_URL`, y si subes RAW también `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) y elige `fixture-db` o `live`.
4. Cron desactivado en el YAML hasta acordar horario y destino.

Detalle de secretos: [`.github/README.md`](../.github/README.md).

Tras merge a `main`: Actions → **Ingest PLACSP** → syndication `placsp_agregadas` + mode `dry-run`.

### Catalunya (Paso 8.5)

Workflow: [`.github/workflows/ingest-catalunya.yml`](../.github/workflows/ingest-catalunya.yml)

1. Actions → **Ingest Catalunya** → **Run workflow**.
2. Rama `tecnico4/semana-03` (hasta merge) + mode **`dry-run`**.
3. `fixture-db` / `live`: mismos secrets; en live mantener `max_pages` bajo.

## Cierre Semana 2 (Paso 10)

Regresión local:

```powershell
cd ingestion
uv sync --extra dev
uv run pytest -q
```

Esperado: **40 passed**, **6 skipped** (tests Postgres/Storage si no hay `supabase start`).

Checklist: [fase2-checklist.md](../docs/plans/fase2-checklist.md).

## Comprobar upsert (Paso 7)

```powershell
uv run pytest -q tests/test_canonical_upsert.py -v
```

## Tests

```powershell
cd ingestion
uv sync --extra dev
uv run pytest -q
```

Los tests de Postgres/Storage requieren `supabase start`. Si no hay stack local, esos tests se saltan.
