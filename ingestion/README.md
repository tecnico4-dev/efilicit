# ingestion/

Motor ETL de EfiLicit (Python 3.12 + uv).

## Setup

```powershell
cd ingestion
uv sync
uv run python -c "import sys; print(sys.version)"
uv run python -m efilicit_ingestion.cli --help
```

## Estado (Fase 0)

Solo el scaffold y el CLI mínimo. El contrato `SourceConnector` y los conectores reales llegan en Semana 1–2 del roadmap.
