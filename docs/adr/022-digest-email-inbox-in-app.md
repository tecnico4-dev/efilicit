# 022 - Digest email → aviso in-app en el buzón (1 = 1 correo)

**Fecha:** 2026-10-29

**Estado:** Aceptado

**Reemplaza:** Ninguno (complementa [012](012-digest-email-job-python-sin-edge-function.md), [013](013-alert-frequencies-daily-weekly-instant-diferido.md))

**Reemplazado por:** Ninguno

---

## Contexto

El buzón `/notifications` solo mostraba cambios de estado en favoritos (`tender_events` ∩ `favorites`). El digest de alertas se enviaba por Resend desde el job Python (`notification_queue` → `drain_daily_digests`) sin dejar rastro en la web más allá de «Licitaciones relacionadas» en la alerta.

Producto: al mandar el correo, el usuario debe ver también un aviso en el buzón con copy del tipo *«Se ha enviado tu email diario/semanal: N licitaciones…»*, fecha (día) y, al pulsar, un modal con la lista plana de esas licitaciones (scroll/paginado, sin carpetas).

## Decisión

1. Tabla `public.digest_inbox_notifications`: un fila por digest enviado (`user_id` + `digest_period` + `frequency` unique); `tender_ids uuid[]`; `read_at` / `trashed_at` en la misma fila (no reutilizar `notification_reads`/`notification_trash`, que FKs a `tender_events`).
2. Tras Resend OK en `drain_daily_digests`, el job materializa el aviso (`PostgresDigestInbox` / `InMemoryDigestInbox`) en la misma transacción de commit del drain.
3. UI: buzón unificado (favoritos-estado + digests); modal estilo «Licitaciones relacionadas» pero lista plana; badge/conteo vía `has_unread_notifications` / `count_unread_notifications`.
4. Sin Edge Function, sin realtime, sin 1 aviso por licitación.

### Alternativas descartadas

- **Listar `notification_queue` status=sent en el buzón.** Mezcla granularidad (ítem = tender) con el email (digest) y choca con lecturas por `event_id`.
- **1 aviso in-app por tender del digest.** Ruido; el modal + «Licitaciones relacionadas» ya cubren el detalle.
- **Carpetas por alerta en el modal.** El aviso representa *el correo*; lista plana suficiente en MVP.

## Consecuencias

### Positivas

- Paridad email ↔ buzón en el momento de verdad del envío.
- Reutiliza el patrón de modal/paginación ya usado en alertas.

### Negativas / riesgos

- Hay que aplicar la migración antes de que el job escriba la tabla.
- Home «Últimos cambios» sigue siendo solo favoritos-estado (el conteo de no leídas sí incluye digests).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Insert inbox falla tras mark_sent | Mismo commit; rollback conjunto |
| Reenvío duplicado (fallo post-Resend, backlog) | `on conflict do nothing` en (user, period, frequency) |
| UUID inválidos en payload | Filtrar al insertar; skip si no queda ninguno |

## Referencias

- Migración `20261029100000_digest_inbox_notifications.sql`
- `ingestion/.../alerts/inbox.py`, `digest.py`, `run_alerts.py`
- Web: `/notifications`, `digest-tenders-panel.tsx`
