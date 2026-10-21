# Backlog

Catálogo de trabajo **consciente fuera del plan** (aplazados, N/A intencionales y mejoras posibles “por si al acabar hace falta”).

No son bugs olvidados ni el trabajo de la siguiente semana del roadmap. Son huecos o mejoras que se sacaron del corte actual a propósito. El detalle vive en ADRs, planes y `cobertura-ccaa`; este archivo es la **vista unificada**.

**Cómo usarlo**

- Priorizar aquí; al cerrar un ítem, quitarlo o moverlo a “Hecho / histórico”.
- `N/A intencional` = no falta implementar “lo olvidado”; fue decisión explícita.
- El plan de la semana en curso (p. ej. Semana 6) **no** se lista aquí: eso va en su `semanaXX-plan` / checklist.

---

## 1. Alertas / notificaciones

- **Otras frecuencias de digest / `instant`.** MVP = `daily` \| `weekly` a nivel de cuenta (`users.digest_frequency`). `instant` (email al detectar coincidencia) y otras cadencias quedan fuera: más emails, otra latencia y otro diseño de drenado ([ADR 013](../adr/013-alert-frequencies-daily-weekly-instant-diferido.md)). Preferencia de cuenta (un correo con todas las alertas), no por alerta.
- **Limpiar CHECK de `alerts.frequency`.** El esqueleto Semana 1 aún admite `instant` en `alerts`; el producto usa `users.digest_frequency`. Alinear esquema / sync cuando se toque migraciones de alertas.
- **Separar match/encolado y envío en dos jobs.** Hoy `run-alerts` hace ambos en un solo proceso; suficiente mientras solo haya daily/weekly ([ADR 012](../adr/012-digest-email-job-python-sin-edge-function.md)).
- **Edge Function de email (N/A intencional).** El digest se envía desde el job Python + Actions, no desde `supabase/functions/` ([ADR 012](../adr/012-digest-email-job-python-sin-edge-function.md)). Replantear solo si hace falta otro canal (p. ej. reenvío desde la web).
- **Doble envío de digest si el job falla tras Resend (aceptado en MVP).** El drenado envía el correo y después marca `notification_queue` como `sent` + `commit`. Si el proceso cae entre ambas, los ítems siguen `pending` y una reejecución puede reenviar el mismo digest. Decisión explícita: preferir un posible duplicado frente a perder el aviso. No endurecer (idempotency key en Resend, estado intermedio, commit por digest, etc.) salvo que el duplicado se observe de forma recurrente en ops.

---

## 2. Email / ops / CI

- **Dominio `eficen.com` en Resend.** Verificación de dominio / envío desde correo corporativo (IT). Pruebas Semana 5 OK con correo personal.
- **Cron de producción — ingestas.** Workflows `ingest-placsp`, `ingest-catalunya`, `ingest-euskadi`: `schedule` off; manual-first hasta OK explícito ([ADR 005](../adr/005-ingesta-actions-manual-first-cron-off.md)).
- **ZIPs grandes al activar cron (PLACSP / Storage).** Hoy descarga + upload a Storage van enteros en memoria (timeout corto en upload). Paquetes ~decenas–centenas de MB pueden fallar en Actions/Storage. Al programar cron: endurecer subida (multipart/resumable o equivalente), timeouts, y **un artefacto/paquete por corrida**. **No** trocear el ZIP oficial en varios RAW inventados (rompe RAW inmutable + checksum). Parse por entries del ZIP ya existe; el foco es transporte/Storage, no falsificar la fuente.
- **Cron de producción — alertas.** `alerts-digest.yml`: mismo patrón; cron off.
- **Scheduling como DoD del MVP.** Criterio de cierre del roadmap: fuentes “programadamente”; activar cuando entorno + secretos + OK.
- **Environments / secrets de deploy.** Preview/production, Vercel, tokens — cablear cuando haya despliegue real (ver `.github/README.md`).
- **CI ingestion sin Postgres en Actions (intencional).** Tests DB en skip en CI; integración local con `supabase start` ([ADR 004](../adr/004-ci-ingestion-sin-postgres.md)).
- **Protección de `main` en GitHub.** Branch protection aplazada en repo Free privado; CI + disciplina manual ([ADR 001](../adr/001-proteccion-main-aplazada.md)).
- **Verificación live `placsp_menores`.** Conector + workflow existen; falta un bloque de pruebas live acotado al estilo de `docs/pruebas.md` (otras fuentes ya tienen Parte).

---

## 3. Ingesta / pipeline / datos canónicos

- **Euskadi: CPV de licitación.** `/contracting-notices` no trae CPV del objeto (`deadlineDate` → ya mapeado a `deadline_at`). El CPV está en `/contracts` (REVASCON), enlazado vía `_links.contracts`. No usar `contractingAuthority.CPV` (actividad del órgano). Mejora: enriquecer avisos con GET al enlace cuando exista; anuncios abiertos sin contrato registrado suelen quedar sin CPV. Valorar después si hace falta ingesta secundaria de `/contracts` (posible ADR de colección). Ficha: [euskadi.md](../sources/euskadi.md).
- **Tabla `public.errors`.** Existe en esquema; el pipeline no escribe ahí de forma sistemática (fallos de corrida → `source_sync`; [ADR 003](../adr/003-acceso-canonico-publico-etl-privado.md)). La bitácora `failed` en `source_sync` **sí** se persiste tras rollback del upsert. Cablear `errors` (p. ej. fallos por registro) solo si hace falta detalle fino; o documentar deprecación.
- **Timeline de versiones dentro del mismo ZIP/Atom PLACSP.** Hoy, si un expediente aparece varias veces, el parse se queda con el `atom:updated` más reciente (estado canónico correcto). Las versiones intermedias no generan `tender_events`. Mejora futura: ordenar por fecha y emitir eventos de transición (p. ej. publicada → plazo ampliado → adjudicada) para la ficha/historial, sin pisar la regla de “estado actual = versión más nueva”. El RAW del ZIP ya conserva la evidencia. Priorizar cuando exista UI de historial.
- **Replay de artefacto en pipeline.** Runbook futuro cuando el pipeline soporte reprocess/replay (`docs/runbooks/`).
- **Catálogo NUTS / geo de búsqueda completa.** Semana 5: geo vía join a organismo; sin catálogo NUTS inventado. Ampliar si el producto lo exige.
- **Adaptador CSV “de familia”.** N/A en Semana 3 salvo bloqueo medible ([ADR 007](../adr/007-adaptador-csv-familia-na-semana3.md)); backlog puntual por CCAA si hace falta.
- **Stub conector (N/A producto).** Solo tests/contrato Semana 1; no es deuda de producto.
- **Tabla `setup_rls_smoke` (andamiaje Fase 0).** No es dominio de licitaciones: se creó en Fase 0 para comprobar Auth + RLS owner-only (cada usuario solo ve lo suyo) y se mantuvo junto al canónico. **Hoy sigue usándose** como health-check en la home de `apps/web` (consulta con clave `anon`/`publishable`: API responde y anon no ve filas ajenas = OK) y el seed mete filas Alice/Bob para jugar en Studio/local. La RLS de producto real está en `users` / `alerts` / etc. **A la larga se puede quitar** (migración + apuntar el health-check a otra tabla o RPC); no urge mientras no estorbe.

---

## 4. Fuentes / cobertura territorial

Detalle por CCAA: [cobertura-ccaa.md](../sources/cobertura-ccaa.md). Checklist al integrar un `source_code` nuevo: [sources/README.md](../sources/README.md) § «Al añadir un source_code nuevo» + [ADR 015](../adr/015-fuente-ganadora-canonica.md) (`SOURCE_PRIORITY`).

- **Hueco: menores de plataformas solo-agregadas.** No entran en `placsp_agregadas` ni en `placsp_menores` (p. ej. Andalucía, La Rioja, …). Candidato post-MVP. Si se abre conector nuevo → meter `source_code` en `SOURCE_PRIORITY` / ADR 015 (no solo parser + ficha).
- **Open Data / conectores propios por CCAA.** Alternativas documentadas (CSV/transparencia) donde hoy basta PLACSP: Andalucía, Asturias, Canarias, Castilla y León, C. Valenciana, Murcia, Navarra, La Rioja, etc. Validar vigencia y solape antes de atacar. **Al implementar:** ficha + conector **y** entrada en el ranking de fuente ganadora ([ADR 015](../adr/015-fuente-ganadora-canonica.md)); si no, la CCAA nueva casi nunca será dueña de `tenders` frente a PLACSP/listadas.
- **Atom Madrid nativo.** No priorizado; solapa con agregadas para no-menores.
- **CCAA propia extra en Semana 4 = 0 (cerrado).** No se añadieron conectores autonómicos nuevos ([ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md)); reabrir solo con hueco medible.
- **`placsp_menores` aplazado S3→S4 (histórico resuelto).** Aplazamiento documentado ([ADR 008](../adr/008-placsp-menores-aplazado-semana4.md)); **implementado** en Semana 4 — se mantiene aquí solo como referencia histórica.
- **Sindicaciones estatales `1383` / `1403` (encargos / CPM).** Fuera de alcance Semana 3; no hay ficha en `docs/sources/`.
- **TED.** Post-MVP / fuera del corte actual. Al integrar: mismo checklist (prioridad relativa vs PLACSP/CCAA en ADR 015 + `SOURCE_PRIORITY`).
- **Subvenciones.** Post-MVP / fuera del corte actual.

---

## 5. Matching / deduplicación multi-fuente

- **UI de revisión humana de matches `pending`.** El motor deja `review_status=pending` + candidato; la revisión humana se sacó del corte de matching MVP.
- **Tabla `match_suggestions` (N candidatos).** Evolución frente a solo `match_candidate_tender_id` ([ADR 010](../adr/010-match-candidate-tender-id-en-tender-sources.md)).
- **Duplicados canónicos mientras haya `pending`.** Comportamiento MVP esperado hasta UI/revisión; no tratarlo como bug sin criterio de producto.
- **Fusión cross-fuente cuando una vía trae NIF y otra no (p. ej. PLACSP ↔ Catalunya).** El auto-merge de licitaciones exige NIF compartido (u otras señales fuertes); Catalunya SODA suele no traer `tax_id` y solo `platform_id` (DIR3). Misma oportunidad en portal autonómico y estatal → a menudo **2 filas en `tenders`** (`pending` / `unmatched`, no `auto`). El organismo también puede quedar **duplicado en `contracting_authorities`**: una fila por NIF y otra por DIR3. Evolución futura: enlazar/fusionar organismo DIR3↔NIF y/o subir confianza del match de licitaciones sin inventar identidad por nombre; probablemente con revisión humana (`pending`) y ADR.

---

## 6. Web / búsqueda

- **Paginación / más de 20 resultados en `/search`.** El buscador MVP limita a **20** resultados a propósito (`search_tenders` / UI). No hay “cargar más” ni páginas. Revisable más adelante si hace falta (paginación o cursor sobre el mismo FTS+trgm, sin cambiar Criteria).

---

## 7. Referencia rápida ADRs (aplazados / N/A)

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
| 012 | Email job Python (sin Edge Function) | N/A Edge Function |
| 013 | `daily`\|`weekly`; `instant` diferido | `instant` / otras cadencias |
| 015 | Fuente ganadora / `SOURCE_PRIORITY` | Al añadir fuente: actualizar ranking (no solo conector) |

---

## Hecho / no reabrir como “pendiente de código”

Ítems que **fueron** aplazamiento y ya están resueltos (no re-priorizar como si faltaran):

- Integración `placsp_menores` (Semana 4).
- Digest email desde job Python (Semana 5; Edge Function N/A a propósito).
- Frecuencias de cuenta `daily` \| `weekly` (Semana 5; `instant` sigue en §1).
- Upsert de organismos por `platform_id` / DIR3 sin NIF ([ADR 014](../adr/014-upsert-organismos-por-platform-id.md)).
- Fuente ganadora canónica (`canonical_source_code` + ranking fijo; sin mezcla de campos) ([ADR 015](../adr/015-fuente-ganadora-canonica.md)).
- Matching: si ambas fuentes traen expediente y difiere → nunca `auto` (como mucho `pending`); NIF + señales blandas sigue válido si falta expediente en un lado.
- Re-ingesta: `tender_events` / `tenders.updated_at` solo si cambian campos canónicos; `tender_sources.last_seen_at` marca que la fuente la ha vuelto a ver.
- Bitácora `source_sync` `failed` persistida tras rollback del upsert (refuerzo [ADR 003](../adr/003-acceso-canonico-publico-etl-privado.md)).
