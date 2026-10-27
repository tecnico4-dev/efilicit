# Runbook — reprocesar por fecha / ventana (`reprocess-source-date`)

Re-ejecutar una fuente para un periodo concreto **sin** inventar RAW ni editar el canónico a mano.

## Principio

La aplicación consume el modelo canónico; el reprocess debe pasar otra vez por **conector → (Storage) → parse → upsert**, con el mismo `source_code` e idempotencia del pipeline.

## PLACSP (Atom / ZIP mensual)

Ventana por meses (`YYYY-MM`):

```bash
cd ingestion
# Local / con secrets
uv run python -m efilicit_ingestion.cli run-placsp \
  --syndication placsp \
  --from-month 2026-09 \
  --to-month 2026-09
```

Sindicaciones: `placsp` | `placsp_agregadas` | `placsp_menores`.

En Actions: **Ingest PLACSP** → mode `live` → `from_month` / `to_month` (+ secrets).  
Modo seguro previo: `dry-run` o `fixture-db`.

El cursor de `source_sync` puede limitar lo “nuevo”; para forzar un mes ya visto, usar una ventana explícita y un `--run-id` nuevo. Si el artefacto ya está en Storage, valorar [replay-artifact.md](replay-artifact.md) cuando exista soporte completo.

## Catalunya (SODA)

Paginas por offset; no hay “mes” nativo. Reprocess = nueva corrida CLI/workflow (fixture o live) con `--run-id` nuevo. Detalle: [`docs/sources/catalunya.md`](../sources/catalunya.md).

```bash
uv run python -m efilicit_ingestion.cli run-catalunya --fixture tests/fixtures/catalunya/valid_page.json --no-storage --run-id reprocess-demo-1
```

## Euskadi

Similar (páginas). Detalle: [`docs/sources/euskadi.md`](../sources/euskadi.md).

```bash
uv run python -m efilicit_ingestion.cli run-euskadi --fixture tests/fixtures/euskadi/valid_page.json --no-storage --run-id reprocess-demo-1
```

## Comprobar

1. `source_sync`: nuevo `run_id`, `status=success`.
2. `source_artifacts`: checksum / `storage_path` si hubo upload.
3. `tender_sources` / `tenders`: sin duplicados espurios (re-ejecutar no debe clonar la misma fuente+id).
4. `source-health` tras el run.

## Prohibido

- Borrar filas canónicas “para limpiar” sin plan.
- Subir un ZIP inventado como si fuera el oficial.
- Usar `service_role` desde el frontend.
