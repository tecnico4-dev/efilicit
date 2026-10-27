# 020 - Alertas: match post-ingesta (ventana sync) + digest diario (solo envío)

**Fecha:** 2026-10-27

**Estado:** Aceptado

**Reemplaza:** Ninguno (complementa / actualiza cadencias de [005](005-ingesta-actions-manual-first-cron-off.md) enmienda Paso 10 y cierra la evolución prevista en [012](012-digest-email-job-python-sin-edge-function.md))

**Reemplazado por:** Ninguno

---

## Contexto

Tras Semana 6 Paso 10 un único cron diario (`alerts-digest.yml`, `write-resend`, `since_days=1`) hacía **match → cola → envío** cada día. Las ingestas productivas, sin embargo, son **semanales** (lunes). Eso dejaba:

- match diario con ventana de calendario casi vacía los días sin descarga;
- acoplamiento de dos ritmos distintos (novedades de fuente vs calendario de correo);
- `since_days` como proxy flojo de “lo recién ingerido”, no de “esta corrida”.

El código ya separaba `run_alert_batch` y `drain_daily_digests`; el backlog ([012](012-digest-email-job-python-sin-edge-function.md) / `BACKLOG`) anticipaba dos jobs.

## Decisión

### Dos jobs de Actions

| Job | Workflow | Cron (UTC) | Qué hace |
|---|---|---|---|
| Match → cola | `alerts-match.yml` | lun `08:00` (tras ingestas 05–07) | Evalúa alertas activas; encola en `notification_queue`. **No** envía email. |
| Drain → Resend | `alerts-digest.yml` | diario `09:00` | Solo drena la cola. Respeta `users.digest_frequency` ([013](013-alert-frequencies-daily-weekly-instant-diferido.md)): **diaria** envía ese día; **semanal** encola y solo envía **lunes UTC**. **No** hace match. |

CLI: `run-alerts --phase match|send|all`. Cron de match → `--phase match`; cron de digest → `--phase send --send`.

### Ventana de match (sin `since_days`)

- **No** se usa ventana por calendario (`since_days`).
- Se toman `source_sync` con `status ∈ {success, partial}` cuya `(finished_at ATUTC)::date` es el día del job (`--sync-date`, default = día UTC del digest/hoy).
- Entran licitaciones cuyo `coalesce(tenders.updated_at, tenders.created_at)` cae en **algún** `[started_at, finished_at]` de esos syncs.
- Se usa **`updated_at` (negocio)**, no `tender_sources.last_seen_at`: una re-visita idéntica en fuente no debe generar alerta; sí altas y cambios canónicos de esa corrida.

### Manual

`workflow_dispatch` sigue en dry-run por defecto. Sin secrets, el schedule falla en el guard.

### Alternativas descartadas

- **Mantener un solo cron diario match+send con `since_days=1` o `7`.** Descartada: confunde ritmos; `since_days=7` es el “parche B” rechazado explícitamente.
- **Ventana por `last_seen_at`.** Descartada: alertaría re-visitas sin cambio.
- **Match “literalmente al acabar cada fuente” (workflow_run encadenado).** Aplazado: un cron lunes 08:00 tras el bloque 05–07 basta al inicio; se puede endurecer después.
- **Backfill al crear/activar alerta en este ADR.** Fuera de corte → backlog (lag documentado hasta entonces).

## Consecuencias

### Positivas

- Match alineado con el ciclo de descarga; envío alineado con la preferencia de cuenta.
- Sin trabajo de match vacío entre lunes.
- Contrato operativo claro en dos YAML + CLI `--phase`.

### Negativas / riesgos

- Si una ingesta del lunes se alarga más allá de 08:00, el match puede ver syncs incompletos o ninguno de esa fuente → re-dispatch manual de `alerts-match` o ajustar hora.
- Alerta creada mid-week **no** ve el catálogo ya en BD hasta el próximo match post-ingesta (salvo backfill futuro en backlog).
- Lunes: digest a las 09:00 para no adelantarse al match de las 08:00.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Match sin syncs success ese día | `tenders_seen=0`; logs `sync_windows=0`; re-run manual |
| Carrera match vs digest el lunes | Digest diario a **09:00**, match a **08:00** |
| Reintroducir `since_days` en cron | Prohibido por este ADR; legado solo en helpers de código para backfill futuro |

## Verificación

- Existen `alerts-match.yml` (lun 08:00, `--phase match`) y `alerts-digest.yml` (diario 09:00, `--phase send`).
- `run-alerts --write --phase match` no llama Resend; no acepta `--send`.
- Ventana = sync del día + `updated_at`; sin input `since_days` en workflows.
- Enmienda en [005](005-ingesta-actions-manual-first-cron-off.md); nota en [012](012-digest-email-job-python-sin-edge-function.md).

## Referencias

- [005](005-ingesta-actions-manual-first-cron-off.md) — cron Actions
- [012](012-digest-email-job-python-sin-edge-function.md) — envío desde Python
- [013](013-alert-frequencies-daily-weekly-instant-diferido.md) — diaria / semanal
- `.github/workflows/alerts-match.yml` · `alerts-digest.yml`
- `ingestion/src/efilicit_ingestion/run_alerts.py` · `alerts/postgres.py`
- `docs/plans/BACKLOG.md` — backfill al crear/activar alerta
