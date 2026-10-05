# Backlog

Catálogo **total** de trabajo consciente fuera del corte actual (aplazados, N/A intencionales, mejoras futuras y ops pendiente).

No son bugs olvidados: son decisiones o huecos documentados en planes, ADRs, `cobertura-ccaa` y roadmap. Este archivo es la **vista unificada**; el detalle vive en las referencias.

**Cómo usarlo**

- Priorizar aquí; al cerrar un ítem, quitarlo o moverlo a “Hecho / histórico”.
- Semana 6 del roadmap absorbe varios ítems de producto web; no duplicar el plan, solo apuntarlos.
- `N/A intencional` = no falta implementar “lo olvidado”; fue decisión explícita.

---

## 1. Alertas / notificaciones

- **Otras frecuencias de digest / `instant`.** MVP = `daily` \| `weekly` a nivel de cuenta (`users.digest_frequency`). `instant` (email al detectar coincidencia) y otras cadencias quedan fuera: más emails, otra latencia y otro diseño de drenado ([ADR 012](../adr/012-alert-frequencies-daily-weekly-instant-diferido.md)). Preferencia de cuenta (un correo con todas las alertas), no por alerta.
- **Limpiar CHECK de `alerts.frequency`.** El esqueleto Semana 1 aún admite `instant` en `alerts`; el producto usa `users.digest_frequency`. Alinear esquema / sync cuando se toque migraciones de alertas.
- **Separar match/encolado y envío en dos jobs.** Hoy `run-alerts` hace ambos en un solo proceso; suficiente mientras solo haya daily/weekly ([ADR 011](../adr/011-digest-email-job-python-sin-edge-function.md)).
- **Edge Function de email (N/A intencional).** El digest se envía desde el job Python + Actions, no desde `supabase/functions/` ([ADR 011](../adr/011-digest-email-job-python-sin-edge-function.md)). Replantear solo si hace falta otro canal (p. ej. reenvío desde la web).

---

## 2. Email / ops / CI

- **Dominio `eficen.com` en Resend.** Verificación de dominio / envío desde correo corporativo (IT). Pruebas Semana 5 OK con correo personal.
- **Cron de producción — ingestas.** Workflows `ingest-placsp`, `ingest-catalunya`, `ingest-euskadi`: `schedule` off; manual-first hasta OK explícito ([ADR 005](../adr/005-ingesta-actions-manual-first-cron-off.md)).
- **Cron de producción — alertas.** `alerts-digest.yml`: mismo patrón; cron off.
- **Scheduling como DoD del MVP.** Criterio de cierre del roadmap: fuentes “programadamente”; activar cuando entorno + secretos + OK.
- **Environments / secrets de deploy.** Preview/production, Vercel, tokens — cablear cuando haya despliegue real (ver `.github/README.md`).
- **CI ingestion sin Postgres en Actions (intencional).** Tests DB en skip en CI; integración local con `supabase start` ([ADR 004](../adr/004-ci-ingestion-sin-postgres.md)).
- **Protección de `main` en GitHub.** Branch protection aplazada en repo Free privado; CI + disciplina manual ([ADR 001](../adr/001-proteccion-main-aplazada.md)).
- **Verificación live `placsp_menores`.** Conector + workflow existen; falta un bloque de pruebas live acotado al estilo de `docs/pruebas.md` (otras fuentes ya tienen Parte).

---

## 3. Ingesta / pipeline / datos canónicos

- **Tabla `public.errors`.** Existe en esquema; el pipeline no escribe ahí de forma sistemática (fallos → `source_sync` + mensaje). Cablear o documentar deprecación.
- **Identidad de organismo sin NIF (p. ej. Catalunya / DIR3).** Upsert por `platform_id` para no acumular `contracting_authorities` huérfanos (migración + ADR si se formaliza).
- **Replay de artefacto en pipeline.** Runbook futuro cuando el pipeline soporte reprocess/replay (`docs/runbooks/`).
- **Catálogo NUTS / geo de búsqueda completa.** Semana 5: geo vía join a organismo; sin catálogo NUTS inventado. Ampliar si el producto lo exige.
- **Adaptador CSV “de familia”.** N/A en Semana 3 salvo bloqueo medible ([ADR 007](../adr/007-adaptador-csv-familia-na-semana3.md)); backlog puntual por CCAA si hace falta.
- **Stub conector (N/A producto).** Solo tests/contrato Semana 1; no es deuda de producto.

---

## 4. Fuentes / cobertura territorial

Detalle por CCAA: [cobertura-ccaa.md](../sources/cobertura-ccaa.md).

- **Hueco: menores de plataformas solo-agregadas.** No entran en `placsp_agregadas` ni en `placsp_menores` (p. ej. Andalucía, La Rioja, …). Candidato post-MVP.
- **Open Data / conectores propios por CCAA.** Alternativas documentadas (CSV/transparencia) donde hoy basta PLACSP: Andalucía, Asturias, Canarias, Castilla y León, C. Valenciana, Murcia, Navarra, La Rioja, etc. Validar vigencia y solape antes de atacar.
- **Atom Madrid nativo.** No priorizado; solapa con agregadas para no-menores.
- **CCAA propia extra en Semana 4 = 0 (cerrado).** No se añadieron conectores autonómicos nuevos ([ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md)); reabrir solo con hueco medible.
- **`placsp_menores` aplazado S3→S4 (histórico resuelto).** Aplazamiento documentado ([ADR 008](../adr/008-placsp-menores-aplazado-semana4.md)); **implementado** en Semana 4 — se mantiene aquí solo como referencia histórica.
- **Sindicaciones estatales `1383` / `1403` (encargos / CPM).** Fuera de alcance Semana 3; no hay ficha en `docs/sources/`.
- **TED.** Post-MVP / fuera del corte actual.
- **Subvenciones.** Post-MVP / fuera del corte actual.

---

## 5. Matching / deduplicación multi-fuente

- **UI de revisión humana de matches `pending`.** El motor deja `review_status=pending` + candidato; no hay pantalla de revisión (Semana 6+).
- **Tabla `match_suggestions` (N candidatos).** Evolución frente a solo `match_candidate_tender_id` ([ADR 010](../adr/010-match-candidate-tender-id-en-tender-sources.md)).
- **Duplicados canónicos mientras haya `pending`.** Comportamiento MVP esperado hasta UI/revisión; no tratarlo como bug sin criterio de producto.

---

## 6. Producto web (Semana 6+ / roadmap §10)

Alcance detallado en plan Semana 6 (rama `tecnico4/semana-06` o merge posterior) y [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 6.

- **Ficha de licitación completa** (vista multi-fuente, documentos, eventos).
- **Favoritos / seguimiento.** Mencionado en arquitectura/onboarding; **aún sin tabla** en migraciones.
- **Dashboard básico** (resumen usuario / actividad).
- **UI de búsquedas guardadas.** Esquema + queries existen; falta experiencia de producto usable (más allá del CRUD mínimo Semana 5).
- **Polish UX.** Responsive, estados vacío/error, brand (Semana 5 = UI mínima verificable; fondo blanco fijo).
- **Healthchecks por fuente.** Más allá de `source_sync` manual.
- **Runbooks operativos.** Carpeta `docs/runbooks/` casi vacía: p. ej. `source-down`, `reprocess-source-date`, `replay-artifact`.
- **Observabilidad / hardening amplio.** Logs, alertas ops, runbooks — post cierre UX mínima.

---

## 7. Higiene documental / repo

- **Índice `docs/plans/README.md`.** Puede desalinearse del estado real de checklists (p. ej. Semana 5 cerrada vs “en curso”).
- **`.github/README.md`.** Mantener al día workflows (menores, Euskadi, alertas, Resend, crons).
- **Plan Semana 6 en `main`.** Vive en `tecnico4/semana-06` hasta merge; tras mergear docs/ADRs a `main`, actualizar esa rama (o recrear) para coherencia.

---

## 8. Referencia rápida ADRs (aplazados / N/A)

| ADR | Tema | Lectura en backlog |
|-----|------|--------------------|
| 001 | Protección `main` | Ops / gobernanza aplazada |
| 003 | Acceso canónico / `errors` reservada | `public.errors` diferido |
| 004 | CI sin Postgres | Intencional MVP |
| 005 | Cron off ingestas/alertas | Ops: activar con OK |
| 007 | Adaptador CSV familia | N/A S3 → backlog puntual |
| 008 | `placsp_menores` S3→S4 | Histórico (ya hecho S4) |
| 009 | CCAA propia extra S4 | N/A → solo con hueco |
| 010 | `match_candidate_tender_id` | MVP; `match_suggestions` después |
| 011 | Email job Python (sin Edge Function) | N/A Edge Function |
| 012 | `daily`\|`weekly`; `instant` diferido | `instant` / otras cadencias |

---

## Hecho / no reabrir como “pendiente de código”

Ítems que **fueron** aplazamiento y ya están resueltos (no re-priorizar como si faltaran):

- Integración `placsp_menores` (Semana 4).
- Digest email desde job Python (Semana 5; Edge Function N/A a propósito).
- Frecuencias de cuenta `daily` \| `weekly` (Semana 5; `instant` sigue en §1).
