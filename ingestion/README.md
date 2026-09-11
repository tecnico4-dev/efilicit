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

Contrato `SourceConnector` + pipeline común + persistencia de `source_sync` / `source_artifacts`.
Conector PLACSP: `discover` → `fetch` → RAW → `parse` → normalize/identidad → **upsert canónico**. CLI E2E en el siguiente paso.

## Comprobar upsert en local (Paso 7)

Con Docker + `supabase start`:

```powershell
cd ingestion
uv run pytest -q tests/test_canonical_upsert.py -v
```

Si todo pasa, en Studio (`http://127.0.0.1:54323`) mira:

1. Table Editor → `tenders` (título fixture, status `published`, CPV `30192700`)
2. `tender_sources` (source_code `placsp`, source_tender_id `B00000000:EXP/2026/0001`)
3. `contracting_authorities` (tax_id `B00000000`, confidence `HIGH`)
4. `tender_events` (`published` y, tras reejecutar el test, también `updated`)
5. `documents` (URL de publicación)

Reejecutar el test no debe crear una segunda fila en `tender_sources` para el mismo id.


## Tests

```powershell
cd ingestion
uv sync --extra dev
uv run pytest -q
```

Los tests de Postgres/Storage requieren `supabase start` (DB `127.0.0.1:54322`, API `54321`).
Si no hay stack local, esos tests se saltan.

Para el test live de RAW (`test_raw_storage.py`), con Supabase local bastan los defaults.
Si quieres fijar la key explícitamente:

```powershell
supabase status -o env
# Copia SERVICE_ROLE_KEY y, en la misma sesión:
$env:SUPABASE_URL = "http://127.0.0.1:54321"
$env:SUPABASE_SERVICE_ROLE_KEY = "<SERVICE_ROLE_KEY de status>"
uv run pytest -q tests/test_raw_storage.py -v
```

