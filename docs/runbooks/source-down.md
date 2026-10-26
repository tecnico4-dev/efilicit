# Runbook — fuente caída (`source-down`)

Cuando una fuente integrada deja de aportar datos o el último run falla.

## 1. Confirmar el síntoma

```bash
cd ingestion
uv run python -m efilicit_ingestion.cli source-health --max-age-hours 48
```

- `status=failed` → error en la última corrida (`error` en la tabla).
- `status=never` / `stale=yes` → no hay success reciente (cron off, secretos, o la fuente no se ha lanzado).
- Studio: tabla `public.source_sync` filtrada por `source_code`.

Fuentes MVP: `placsp`, `placsp_agregadas`, `placsp_menores`, `catalunya`, `euskadi`.  
Fichas: [`docs/sources/`](../sources/).

## 2. Clasificar

| Señal | Acción típica |
|---|---|
| HTTP 4xx/5xx / timeout en logs del workflow | Comprobar URL/API de la fuente; reintentar más tarde |
| Cambio de esquema / parse error | Fixture + tests del conector; no parchear datos a mano en prod |
| Secrets / `EFILICIT_DATABASE_URL` | [`.github/README.md`](../../.github/README.md) |
| Storage / ZIP enorme | BACKLOG ZIPs grandes; no trocear el RAW oficial |

## 3. Mitigar sin tocar canónico a mano

1. **No** editar `tenders` / `tender_sources` en SQL Editor como arreglo habitual.
2. Relanzar el workflow de la fuente en modo seguro primero (`dry-run` / `fixture-db`).
3. Si el fallo es de ventana de fechas → [reprocess-source-date.md](reprocess-source-date.md).
4. Si el RAW ya está en Storage y el pipeline soporta replay → [replay-artifact.md](replay-artifact.md) (hoy: limitado).

## 4. Workflows

| Fuente | Workflow |
|---|---|
| PLACSP (+ agregadas / menores) | `ingest-placsp.yml` |
| Catalunya | `ingest-catalunya.yml` |
| Euskadi | `ingest-euskadi.yml` |

Cron de producción: **off** hasta Paso 10 + OK ([ADR 005](../adr/005-ingesta-actions-manual-first-cron-off.md)).

## 5. Cerrar el incidente

- Anotar `run_id` / `source_code` / hora.
- Si hace falta cambio de código: PR + fixtures + migración si tocó esquema.
- Volver a pasar `source-health` hasta `success` no stale (según el SLA que acordéis).
