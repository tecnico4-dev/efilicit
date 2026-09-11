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
Conector PLACSP: `discover` de paquetes mensuales oficiales (sindicación `643`). `fetch` / `parse` en pasos siguientes.

## Tests

```powershell
cd ingestion
uv sync --extra dev
uv run pytest -q
```

Los tests de Postgres requieren `supabase start` (DB en `127.0.0.1:54322`). Si no hay DB, esos tests se saltan.
