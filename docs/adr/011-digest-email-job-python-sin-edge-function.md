# 011 - Envío de digest de alertas desde el job Python (Edge Function N/A)

**Fecha:** 30-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El plan de Semana 5 deja abierto el mecanismo de envío del digest por email:

> Resend vía **Edge Function** y/o drenado desde el **job batch** (secretos fuera del frontend).

La arquitectura fija incluye Edge Functions en el stack Supabase. La carpeta `supabase/functions/` estaba vacía al cerrar Semana 4; el motor de alertas batch (match → `notification_queue`) vive en Python (`efilicit_ingestion.alerts`) y se orquesta con GitHub Actions (`alerts-digest.yml`), en la misma línea que las ingestas.

Meter una Edge Function solo para llamar a Resend habría significado:

- un segundo runtime (Deno/TS) con secretos y despliegue propios;
- duplicar o repartir la lógica de drain (agrupar pending, marcar `sent`/`failed`, idempotencia);
- más superficie operativa sin ganar criterios de salida del MVP (batch-first + un email por usuario/periodo).

---

## Decisión

En Semana 5 el envío Resend se hace **desde el job Python** del digest:

- `alerts/digest.py` drena `pending` → un email por usuario/periodo;
- `alerts/email.py` (`FakeEmailSender` / `ResendEmailSender`);
- CLI `run-alerts` + workflow `alerts-digest.yml` (dry-run por defecto; cron off, ADR 005).

**Edge Function de email = N/A** en este corte. `supabase/functions/` sigue sin función de digest/Resend.

### Alternativas descartadas

- **Edge Function que solo envía y el job solo encola.** Descartada en Semana 5: dos piezas a sincronizar; el job ya necesita leer la cola y actualizar estado.
- **Solo Edge Function disparada por webhook/cron Supabase.** Descartada: el orquestador batch acordado es GitHub Actions; mezcla de schedulers sin necesidad medible.
- **Llamar Resend desde el frontend.** Descartada: expondría secretos; viola seguridad por defecto.

---

## Consecuencias

### Positivas

- Un solo camino batch: match → cola → digest → Resend, testeable sin red (`FakeEmailSender`).
- Secretos (`RESEND_API_KEY`, etc.) solo en entorno del job / Actions.
- Queda explícito que el N/A de Edge Function no es un olvido del stack Supabase.

### Negativas / riesgos

- Quien espere “email = Edge Function” puede confundirse; este ADR + BACKLOG lo aclaran.
- Separar match/encolado y envío en dos jobs (u otra pieza) queda como evolución posible (`docs/plans/BACKLOG.md`), no como deuda de Semana 5.

---

## Verificación

- No existe función de digest/Resend bajo `supabase/functions/`.
- `ingestion/src/efilicit_ingestion/alerts/digest.py` + `email.py` + tests `test_alert_digest`.
- `docs/plans/semana05-plan.md` / `fase5-checklist.md`: Paso 8 — Edge Function N/A.
- Workflow `.github/workflows/alerts-digest.yml`.

---

## Referencias

- `docs/01-arquitectura-fija.md` (Supabase + Resend; alertas batch-first)
- `docs/04-roadmap-mvp.md` § Semana 5
- `docs/plans/semana05-plan.md` · `docs/plans/fase5-checklist.md`
- `docs/plans/BACKLOG.md` (separar match y envío)
- [ADR 005](005-ingesta-actions-manual-first-cron-off.md) (cron off / manual-first)
