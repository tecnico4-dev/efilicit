# Backlog

Ítems conscientes fuera del corte actual. No son bugs; son trabajo futuro a priorizar.

## Alertas / notificaciones

- **Otras frecuencias de digest / `instant`.** El MVP de Semana 5 cubre `daily` y `weekly` a nivel de cuenta (`users.digest_frequency`). `instant` (email al detectar coincidencia) y otras cadencias posibles quedan fuera: más emails, otra latencia y otro diseño de drenado ([ADR 012](../adr/012-alert-frequencies-daily-weekly-instant-diferido.md)). La preferencia sigue siendo de cuenta (un correo con todas las alertas), no por alerta.
- **Separar match/encolado y envío en dos jobs.** Hoy `run-alerts` hace ambos en un solo proceso; no hace falta mientras solo haya daily/weekly ([ADR 011](../adr/011-digest-email-job-python-sin-edge-function.md)).

## Ingesta / datos

- **Identidad de organismo sin NIF (p. ej. Catalunya / DIR3).** Upsert por `platform_id` para no acumular `contracting_authorities` huérfanos (requiere migración + ADR si se formaliza).
- **Tabla `public.errors`.** Existe en esquema; el pipeline aún no escribe ahí de forma sistemática.

## Email / ops

- **Dominio `eficen.com` en Resend.** Verificación de dominio / envío desde correo corporativo (IT).
- **Cron de producción** de ingestas y `alerts-digest.yml` (siguen off hasta OK explícito).
