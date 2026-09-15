# ingestion/

Motor ETL de EfiLicit (Python 3.12 + uv).

## Setup

```powershell
cd ingestion
uv sync
uv run python -c "import sys; print(sys.version)"
uv run python -m efilicit_ingestion.cli --help
```

## Estado (Semana 2)

PLACSP vertical slice cableado en CLI:

`discover` → `fetch` → RAW → `parse` → normalize/identidad → upsert canónico.

## Corrida E2E local (Paso 8)

### Dry-run (sin escribir DB)

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --dry-run `
  --as-of 2026-09-11
```

Esperado: `status=success`, `records_seen=1`, `raw_path=raw/placsp/...`.

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

(`--no-storage` evita depender de la service_role; añade Storage omitiendo ese flag si tienes `SUPABASE_SERVICE_ROLE_KEY`.)

Luego en Studio (`http://127.0.0.1:54323`):

1. `source_sync` → `run_id` = `demo-placsp-1`, status `success`
2. `source_artifacts` → path/checksum del ZIP fixture
3. `tenders` / `tender_sources` → licitación fixture
4. Reejecutar el mismo comando con otro `--run-id` → no duplica `tender_sources`

### Live PLACSP (opcional, red real)

```powershell
uv run python -m efilicit_ingestion.cli run-placsp --from-month 2026-09 --to-month 2026-09
```

Solo cuando quieras probar descarga oficial (ZIPs pueden ser grandes).

## GitHub Actions (Paso 9)

Workflow: [`.github/workflows/ingest-placsp.yml`](../.github/workflows/ingest-placsp.yml)

1. Repo → **Actions** → **Ingest PLACSP** → **Run workflow**.
2. Empieza con mode **`dry-run`** (sin secretos).
3. Para escribir en un entorno remoto: configura secrets (`EFILICIT_DATABASE_URL`, y si subes RAW también `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) y elige `fixture-db` o `live`.
4. Cron desactivado en el YAML hasta acordar horario y destino.

Detalle de secretos: [`.github/README.md`](../.github/README.md).

Tras merge a `main`: Actions → **Ingest PLACSP** → **Run workflow** → mode `dry-run` (comprueba el YAML en GitHub).

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
