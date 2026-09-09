# ingestion/

Motor ETL de EfiLicit (Python 3.12 + uv).

## Setup

```powershell
cd ingestion
uv sync
uv run python -c "import sys; print(sys.version)"
uv run python -m efilicit_ingestion.cli --help
```

## Estado (Semana 1)

Contrato `SourceConnector` + pipeline común mínimo (`run_pipeline`) con etapas del roadmap.
Persistencia de sync/artifacts en memoria por ahora; Postgres en el siguiente paso.
Conectores reales de fuente (p. ej. PLACSP) llegan en Semana 2.
