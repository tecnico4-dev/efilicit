# 012 - Frecuencia de alertas MVP: `daily` | `weekly`; `instant` diferido

**Fecha:** 05-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El esqueleto Semana 1 de `alerts` admite en CHECK valores de frecuencia que incluyen `instant` (y `weekly` / `daily`). El roadmap de Semana 5 pide alertas **batch-first** con digest (no un email por cada `INSERT` de ingesta) e idempotencia vía `notification_queue`.

Tras implementar el motor batch, la preferencia de producto acordada es:

- un **correo por usuario y periodo**, agrupando coincidencias de **todas** sus alertas;
- cadencia elegida a nivel de **cuenta** (`public.users.digest_frequency`), no por alerta suelta.

Se implementaron **`daily`** y **`weekly`** (periodo día vs semana ISO; weekly solo drena/envía en **lunes UTC**; el resto de días encola y deja `pending`).

**`instant`** (avisar en cuanto hay match) implicaría:

- mucha más carga de correos (lo contrario del digest batch-first);
- otra latencia y otro diseño de drenado (casi “push” por coincidencia);
- poco beneficio frente a daily/weekly para el corte MVP.

Otras cadencias posibles (p. ej. quincenal) tampoco forman parte del MVP: solo si en el futuro se priorizan en backlog.

---

## Decisión

MVP de notificaciones por email en Semana 5:

| Preferencia de cuenta | Comportamiento |
|---|---|
| `daily` | Periodo = día calendario UTC; drain cuando hay `pending`. |
| `weekly` | Periodo = semana ISO (`YYYY-Www`); envío solo lunes UTC; entre medias se encola. |

- Columna: `public.users.digest_frequency` ∈ `{daily, weekly}` (default `daily`).
- UI: `/account` (formulario) + copy en `/alerts`.
- Motor: `digest_period` / `should_send_digest` + drain en `alerts/digest.py`.

**`instant` = diferido** (no implementado en el motor ni expuesto en la preferencia de cuenta). Otras periodicidades = **backlog** solo si se cree necesario (`docs/plans/BACKLOG.md`).

El CHECK histórico de `alerts.frequency` que menciona `instant` no implica soporte de producto: la cadencia operativa del digest es la de la **cuenta**.

### Alternativas descartadas

- **Implementar `instant` en Semana 5.** Descartada: complejidad alta, inundación de email, choca con batch-first / digest.
- **Solo `daily` (sin weekly).** Descartada tras iteración de producto: weekly reduce ruido sin salir del modelo digest.
- **Frecuencia por alerta en vez de por cuenta.** Descartada en el MVP: un usuario recibiría varios digests el mismo día; se prioriza un correo agregado.
- **Quitar `instant` del CHECK de `alerts.frequency` en la misma semana.** No bloqueante; limpieza de esquema queda fuera de este ADR (puede hacerse luego si molesta).

---

## Consecuencias

### Positivas

- MVP alineado con “menos correos, más señal”: daily o weekly a elección.
- `instant` queda explícitamente fuera (no es un bug de “falta el enum”).
- Backlog documenta cuándo replantear otras cadencias.

### Negativas / riesgos

- Usuarios que esperen aviso inmediato no lo tienen hasta priorizar backlog.
- Convivencia temporal: columna/legacy `alerts.frequency` vs `users.digest_frequency` — la fuente de verdad del digest es la cuenta.

---

## Verificación

- Migración `supabase/migrations/20261005120000_user_digest_frequency.sql`.
- `ingestion/src/efilicit_ingestion/alerts/queue.py` (`digest_period`, `should_send_digest`).
- Tests `test_alert_digest` (daily + weekly martes/lunes + idempotencia).
- `docs/plans/BACKLOG.md` · `CHANGELOG.md` · plan/checklist Semana 5.

---

## Referencias

- `docs/04-roadmap-mvp.md` § Semana 5 (alertas batch-first / digest)
- `docs/01-arquitectura-fija.md` (alertas batch-first)
- `docs/plans/semana05-plan.md` · `docs/plans/fase5-checklist.md`
- `docs/plans/BACKLOG.md`
- [ADR 011](011-digest-email-job-python-sin-edge-function.md) (envío desde job Python)
