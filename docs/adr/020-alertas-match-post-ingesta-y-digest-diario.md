# 020 - Alertas: match post-ingesta + digest diario; despertador = cron externo

**Fecha:** 2026-10-28 (reescritura; decisión match/digest 2026-10-27)

**Estado:** Aceptado

**Reemplaza:** Ninguno (complementa / actualiza cadencias de [005](005-ingesta-actions-manual-first-cron-off.md); cierra la evolución prevista en [012](012-digest-email-job-python-sin-edge-function.md); sustituye la confianza en `on.schedule` de GitHub para ingest/alertas)

**Reemplazado por:** Ninguno

---

## Contexto

Tras Semana 6 Paso 10 un único cron diario (`alerts-digest.yml`, `write-resend`, `since_days=1`) hacía **match → cola → envío** cada día. Las ingestas productivas son **semanales** (lunes). Eso dejaba match diario casi vacío y acoplaba dos ritmos distintos; `since_days` era un proxy flojo de “esta corrida”.

Se separaron dos jobs (match post-ingesta / digest solo envío) con ventana `source_sync` + `updated_at`.

En producción, los `on.schedule` nativos de GitHub **no dispararon** (best-effort: retrasos o drops sin run). Por eso el despertador pasa a un **cron externo** que llama `workflow_dispatch` vía API; Actions sigue ejecutando el trabajo con los secrets del repo.

## Decisión

### Orquestación (despertador)

- **Reloj:** servicio externo (p. ej. [cron-job.org](https://cron-job.org)) → `POST .../actions/workflows/<file>/dispatches` con PAT (`actions:write`).
- **Trabajo:** GitHub Actions (`workflow_dispatch` + secrets). Los YAML de ingest/alertas **no** llevan `on.schedule`.
- Procedimiento: [docs/runbooks/external-cron-dispatch.md](../runbooks/external-cron-dispatch.md); prueba local: `scripts/dispatch-workflow.sh`.

### Dos jobs de Actions (producto)

| Job | Workflow | Cadencia estable (UTC) | Qué hace |
|---|---|---|---|
| Match → cola | `alerts-match.yml` | lun `08:00` (tras ingestas 05–07) | Evalúa alertas activas; encola en `notification_queue`. **No** envía email. |
| Drain → Resend | `alerts-digest.yml` | diario `09:00` | Solo drena la cola. Respeta `users.digest_frequency` ([013](013-alert-frequencies-daily-weekly-instant-diferido.md)): **diaria** ese día; **semanal** solo **lunes UTC**. **No** hace match. |

CLI: `run-alerts --phase match|send|all`. Match → `--phase match`; digest → `--phase send --send`.

Ingestas (mismo despertador externo): PLACSP ×3 lun 05:00; Catalunya lun 06:00; Euskadi lun 07:00. Un dispatch PLACSP = **una** sindicación (tres jobs HTTP).

### Ventana de match (sin `since_days`)

- **No** ventana por calendario (`since_days`).
- `source_sync` con `status ∈ {success, partial}` cuya `(finished_at ATUTC)::date` es el día del job (`--sync-date`, default = día UTC).
- Licitaciones cuyo `coalesce(tenders.updated_at, tenders.created_at)` cae en algún `[started_at, finished_at]` de esos syncs.
- Se usa **`updated_at` (negocio)**, no `tender_sources.last_seen_at`.

### Manual

`workflow_dispatch` desde UI o script: dry-run por defecto. Sin secrets, modos write fallan en el guard.

### Alternativas descartadas

- **Confiar en `on.schedule` de GitHub.** Descartada: best-effort; retrasos/drops sin run (observado en prod).
- **Mantener un solo cron diario match+send con `since_days`.** Descartada: confunde ritmos.
- **Ventana por `last_seen_at`.** Descartada: alertaría re-visitas sin cambio.
- **Match encadenado con `workflow_run` tras cada fuente.** Aplazado: un disparo lunes 08:00 tras el bloque 05–07 basta al inicio.
- **Backfill al crear/activar alerta en este ADR.** Fuera de corte → backlog.

## Consecuencias

### Positivas

- Match alineado con descarga; envío alineado con preferencia de cuenta.
- Despertador bajo control operativo (horario y reintentos del servicio externo).
- Contrato claro: dos YAML + CLI `--phase` + runbook de dispatch.

### Negativas / riesgos

- PAT / secreto del despertador **fuera del repo**; rotación y scope mínimos.
- Si se reactiva `on.schedule` **y** el cron externo, doble disparo.
- Si una ingesta del lunes se alarga más allá de 08:00, el match puede ver syncs incompletos → re-dispatch de `alerts-match`.
- Alerta creada mid-week no ve el catálogo hasta el próximo match (salvo backfill en backlog).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| GitHub `schedule` silencioso | No usar `on.schedule` en ingest/alertas; despertador externo |
| Doble corrida | No reintroducir `schedule` mientras el cron externo esté activo |
| PAT filtrado | Fine-grained mínimo; no versionar; rotar si hay sospecha |
| Match sin syncs success ese día | `tenders_seen=0`; re-dispatch manual |
| Carrera match vs digest el lunes | Digest 09:00, match 08:00 |
| Reintroducir `since_days` en el match post-ingesta | Prohibido; legado solo para backfill futuro |

## Verificación

- Workflows ingest/alertas: solo `workflow_dispatch`; sin `on.schedule`.
- Runbook external-cron-dispatch + script `dispatch-workflow.sh`.
- Cadencia estable documentada (lun ingest/match; digest diario 09:00 UTC).
- `run-alerts --write --phase match` no llama Resend; no acepta `--send`.
- Ventana = sync del día + `updated_at`; sin input `since_days` en workflows.
- Enmienda en [005](005-ingesta-actions-manual-first-cron-off.md).

## Referencias

- [005](005-ingesta-actions-manual-first-cron-off.md) — historia manual-first → cron
- [012](012-digest-email-job-python-sin-edge-function.md) — envío desde Python
- [013](013-alert-frequencies-daily-weekly-instant-diferido.md) — diaria / semanal
- [docs/runbooks/external-cron-dispatch.md](../runbooks/external-cron-dispatch.md)
- `.github/workflows/alerts-match.yml` · `alerts-digest.yml` · ingest-*
- `scripts/dispatch-workflow.sh`
- `ingestion/src/efilicit_ingestion/run_alerts.py` · `alerts/postgres.py`
- `docs/plans/BACKLOG.md` — backfill al crear/activar alerta
