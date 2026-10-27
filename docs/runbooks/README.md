# Runbooks

Procedimientos operativos del MVP (Semana 6 / Paso 9).

| Runbook | Uso |
|---|---|
| [source-down.md](source-down.md) | Fuente fallida o sin success reciente |
| [reprocess-source-date.md](reprocess-source-date.md) | Re-ejecutar una ventana / corrida |
| [replay-artifact.md](replay-artifact.md) | Replay desde Storage (aún limitado; workaround) |
| [wipe-app-data.md](wipe-app-data.md) | Vaciar dominio/producto; conservar users + geo |

Healthcheck rápido:

```bash
cd ingestion
uv run python -m efilicit_ingestion.cli source-health
```

RLS: [docs/security/rls-inventory.md](../security/rls-inventory.md).
