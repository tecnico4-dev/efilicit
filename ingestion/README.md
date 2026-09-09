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

Contrato `SourceConnector` (`discover` / `fetch` / `parse`) + modelos Pydantic + stub de prueba.
Conectores reales de fuente (p. ej. PLACSP) llegan en Semana 2.
