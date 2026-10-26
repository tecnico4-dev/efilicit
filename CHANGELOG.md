# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Semana 6 Paso 9 (hardening): inventario RLS (`docs/security/rls-inventory.md` + `scripts/verify_rls_enabled.sql`); CLI `source-health` sobre `source_sync`; runbooks `source-down`, `reprocess-source-date`, `replay-artifact`.
- Script `scripts/seed_demo_remote.py`: vacía dominio remoto (conserva users + geo) e inserta ~50 licitaciones demo ES variadas para demos (Vercel/Supabase).
- Ficha: botón «Histórico registrado» junto al estado (si hay hitos en `tender_events`); popover con fecha → estado (hover preview, click para fijar).
- Plazos: `deadline_at` canónico en UTC; valores sin offset (p. ej. PLACSP) se interpretan como `Europe/Madrid`. UI muestra hora peninsular. Canarias → BACKLOG.
- Semana 6 Paso 8: estados carga/vacío/error unificados (`RouteSkeleton`, `ErrorState`, `EmptyState`); `loading.tsx` en inicio, búsqueda, ficha, favoritos, alertas y notificaciones; 404 raíz.
- Buscador: filtro «Solo en plazo» (`en_plazo=1` / `open_for_submission`; `deadline_at > now()`, sin plazo = fuera; off por defecto).
- Buscador: al guardar búsqueda, modal para indicar nombre (Aceptar/Cancelar; aviso si el nombre ya existe).
- Ficha: CPV con etiqueta del diccionario (`código-descripción`), una fila por código.
- CPV multivalor: tabla `tender_cpvs` (todos los códigos iguales; sin `tenders.cpv_code`); búsqueda/matching/alertas/UI sobre el conjunto; modo `cpv_match` `any`|`all` ([ADR 019](docs/adr/019-tender-cpvs-multivalor.md)).
- Buscador: diccionario CPV estructurado (TED/SIMAP CPV 2008 ES oficial: `label` + `parent`/`children`, ~9454 códigos); campo «Código CPV (prefijo)» + Añadir → «CPV seleccionados»; varios CPV por búsqueda. Script `scripts/build_cpv_es_dictionary.py`.
- Buscador: filtros Estado / Procedimiento / Tipo de contrato (desplegables «Todos» + valores presentes en BD, etiquetas legibles) y fechas de publicación desde/hasta; CCAA sin licitaciones visibles en gris y no seleccionables. RPC `list_tender_filter_options`.
- Notificaciones in-app: lectura por aviso (`notification_reads`); pestañas Todas / No leídas estilo carpeta; puntito azul en cada aviso no leído y en el buzón del nav.
- Notificaciones in-app: cambios de estado en licitaciones favoritas (`tender_events` ∩ `favorites`); buzón `/notifications` y puntito de no leídas (`users.notifications_read_at`).
- Login: fondo animado a pantalla completa (hojas/carpetas/`.zip` que caen y se amontonan; cielo en gradiente marca; reacción suave al ratón); card con entrada suave, sombra/glow y tagline; toggle sol/luna discreto.
- Login como entrada: `/` sin sesión y cierre de sesión van a `/login` (sin landing intermedia; eliminado `HomeLanding`); [ADR 016](docs/adr/016-auth-invite-only-sin-registro-publico.md) actualizado.
- Geografía de lugar de ejecución: catálogos `geo_ccaa` / `geo_municipio`, columnas `tenders.place_nuts_code` / `place_ccaa_code` / `place_municipality_code`; NUTS→CCAA en normalize ([ADR 018](docs/adr/018-geografia-lugar-ejecucion-ccaa-municipio.md)).
- Catalunya: `codi_ine10` → `place_municipality_code`; seed `geo_municipio` (`ingestion/data/geo_municipio.csv` + `scripts/seed_geo_municipio.py`).
- Inferencia de municipio desde título (`de/del/de la…` o `(Municipio)`) si hay CCAA y falta código INE; filtro CCAA en `/search` y campos CCAA/municipio en ficha ([ADR 018](docs/adr/018-geografia-lugar-ejecucion-ccaa-municipio.md)).
- Inferencia 3.º escalón: órgano `Ayuntamiento/Ajuntament/… de X`; typeahead Municipio en búsqueda (solo con CCAA; municipios con licitaciones).
- Nombres de `geo_ccaa` con tildes UTF-8 literales (`Andalucía`, `León`, …); no aplicar migraciones con pipe Windows `Get-Content|psql` (rompe encoding).
- Semana 6 Paso 7: dashboard básico en `/` autenticada (alertas activas, favoritos recientes, búsquedas guardadas + accesos); landing anónima sin cambios.
- Semana 6 Paso 6: gestión de alertas de producto — crear/editar/activar en `/alerts` (criteria v1); crear alerta desde `/search` (solo sesión); sin copy de prueba.
- Semana 6 Paso 5: favoritos (`favorites` + RLS owner-only); marcar/desmarcar en ficha (solo sesión); lista `/favorites`; verificación Alice≠Bob.
- Semana 6 Paso 4: multi-fuente en ficha — lista `tender_sources` con badge de fuente canónica.
- Semana 6 Paso 3: ficha de licitación `/tenders/[id]` (campos canónicos MVP) y enlace desde resultados de `/search`.
- Semana 6 Paso 2: buscador `/search` con UX de producto (filtros, estados vacío/error/carga, responsive); sigue usando `searchTenders`.
- Semana 6: tema oscuro por defecto + opción claro (`next-themes`, toggle en cabecera; tokens `.dark` corporativos).
- Semana 6 Paso 1: design system base en `apps/web` (tokens corporativos, `AppShell`/`AppHeader`, `Button`/`Input`, home y login con identidad Eficen).
- Semana 6 Paso 0: kit visual corporativo en `docs/brand/` (tokens CSS Eficen/EfiLumen, patrones UI, tipografía Geist); logo oficial pendiente.
- Plan y checklist Semana 6 (`semana06-plan`, `fase6-checklist`): web integrada + cierre MVP; Paso 0 = kit visual corporativo; rama `tecnico4/semana-06`.
- Fuente ganadora canónica: columna `tenders.canonical_source_code` + ranking fijo PLACSP > CCAA; secundaria solo enlaza en `tender_sources`; promoción reemplaza la fila entera ([ADR 015](docs/adr/015-fuente-ganadora-canonica.md)).
- Upsert de `contracting_authorities` por `platform_id` (p. ej. DIR3) cuando no hay NIF/CIF: columna + índice único parcial; re-ingestas Catalunya sin organismos huérfanos ([ADR 014](docs/adr/014-upsert-organismos-por-platform-id.md)).

### Added

- Notificaciones: papelera por aviso (icono); pestaña «Papelera» (30 días; aviso de caducidad + recuperar a Todas; luego ocultas vía `notification_trash`).

### Changed

- CI: el workflow se dispara también en pull requests (no solo `main`) y admite `workflow_dispatch`.
- ESLint: `react-hooks/set-state-in-effect` en warn (patrones mounted/pager); evita fallar CI hasta refactor.
- Nav: el puntito de no leídas usa RPC `has_unread_favorite_status_notifications` (EXISTS) en lugar de montar la lista completa de avisos en cada navegación.
- Layout: cabecera y badge de no leídas en `Suspense` — `AppShell` ya no espera auth/unread antes de pintar `{children}` (navegación más reactiva).
- Inicio: métrica «Sin leer» + 3 avisos recientes vía RPC (`count_unread_*` / `list_recent_*`) en lugar de montar el buzón completo.
- Favoritos: `last_seen_at` con RPC `tender_max_last_seen` (agregado) sin embeber todas las `tender_sources`.
- Notificaciones: pestañas Todas / No leídas / Papelera filtran en cliente (sin recargar el buzón); la URL `?view=` se actualiza con `replaceState`.
- Buscador: un solo client Supabase + `Promise.all` (filtros + perfil); al paginar se reutiliza `?tc=` / `p_known_total` para no recountar el universo en cada página.
- Pager (`ListPager`): el número de página solo aplica al Enter o al salir del campo (no en cada tecla).
- Auth RSC: `getSessionUser` / `getSessionProfile` (+ client) memoizados con React `cache` por request — AppShell y páginas no repiten `getUser`/perfil.
- Auth: páginas de producto ya no re-validan sesión con redirect a `/login` (lo hace el middleware); solo piden `getSessionProfile` cuando necesitan `userId`/preferencias.
- Buscador: formulario visible de inmediato; filtros DISTINCT y «Guardar búsqueda» en Suspense; diccionario CPV (~9k) en carga diferida (idle / al usar CPV).
- Alertas: título al instante; crear alerta + lista detrás de Suspense; `loading.tsx` con cara de página (no skeleton genérico).
- Buscador: pager igual que favoritos (`ListPager`, 10/20/50/100); ancla `#resultados` + scroll interno arriba al paginar; `total_count` en RPC.
- Favoritos (licitaciones y búsquedas): al cambiar de página el scroll interno del panel vuelve arriba.
- Favoritos: «Datos actualizados» (Hoy / Ayer / fecha) = `max(tender_sources.last_seen_at)`, a la derecha del título.
- Buscador CPV: al escribir el prefijo se sugieren continuaciones del diccionario (typeahead; flechas/Enter/clic).
- Alertas batch: la ventana de licitaciones del job ya no se corta a 5.000; ese valor es **tamaño de página** y se pagina (keyset) hasta agotar el «último día» (`load_tender_candidates`).
- Buscador / alertas — semántica y ranking (sin ADR nuevo; contrato RPC = [ADR 011](docs/adr/011-busqueda-via-rpc-search-tenders.md)):
  1. Stopwords (`de`, `el`, `la`…) y tokens de menos de 2 caracteres fuera; resto en **AND** (misma lógica en `/search`, alertas y búsquedas guardadas: `keywords.ts` / `alerts/keywords.py`).
  2. Si el Texto solo tiene stopwords → aviso en UI y **no** se llama a la RPC.
  3. Filtros duros (CCAA, estado, CPV, fechas, …) sí/no; luego FTS ∪ trgm con **top-K ≈ 300** por rama (`20261022130000_…`); trgm solo si la query tiene 3–120 caracteres.
  4. Orden final: nota texto → fecha publicación → nº prefijos CPV cubiertos si hay filtro CPV (`20261022140000_…`, útil en `any`) → `created_at`; UI pagina de 10 (`total_count`).
  Detalle operativo: `apps/web/src/lib/queries/README.md`.
- Ingesta: títulos canónicos en «grito» (casi todo mayúsculas) se reformatean (capitalización + partículas en minúscula; siglas cortas CPV/SA/UTE… intactas); títulos ya mixtos no se tocan.
- Ingesta: `estimated_value` canónico = importe **sin IVA** (PLACSP: `TaxExclusiveAmount`; Catalunya: `pressupost_licitacio_sense`; Euskadi: `budgetWithoutVAT`). Filas existentes requieren re-ingesta de la fuente propietaria.
- Cabecera: nav con scroll horizontal en móvil; Favoritos abre submenú al primer toque en dispositivos sin hover fino.
- Padding de páginas alineado con cabecera (`px-4 sm:px-6`).
- Nombres de CCAA en castellano homogéneo (`Islas Baleares`, `Comunidad Valenciana`, `Castilla La Mancha`, …) en filtro de búsqueda y catálogo `geo_ccaa`.
- Notificaciones: no leído por aviso (`notification_reads`) al abrir la ficha; abrir el buzón ya no marca todas como leídas. Elegibilidad sigue con `tender_events.created_at`.
- Notificaciones de favoritos: elegibilidad y no leído usan `tender_events.created_at` (cuándo lo vimos en BD), no `occurred_at` de origen; se sigue mostrando la fecha de negocio.
- Home autenticada: panel de vista rápida (saludo, métricas clicables, plazos de favoritos, últimos cambios de estado) con animaciones CSS; sin hero de marca ni listas plegables.
- CPV canónico: 8 dígitos con ceros a la derecha + control opcional `-X` (`316400`→`31640000`, `31640000-4` se conserva); migración alinea filas existentes.
- Auditoría remota de vocabulario/CPV/NUTS: sin literales CODICE huérfanos; migración de higiene defensiva.
- Euskadi: `contractType` ampliado a CODICE completo (concesiones `22`/`31`/`32`, etc.); si `id` es código CODICE conocido, se usa antes que el nombre.
- Catalunya: concesiones en `tipus_contracte` → CODICE `22`/`31`/`32`/`21` (antes se aplanaban a servicios/obras).
- Catalunya / Euskadi: `procediment` / `contractProcedureType` → código CODICE de procedimiento (antes quedaba `procedure_type` null y solo la etiqueta).
- `tenders.status`: mapa CODICE `ContractFolderStatus` (`ANUL` oficial + alias `ANU`; `DES`→`desierta`); desconocidos → `null`; migración remapea literales en `tenders` y `tender_events.event_status`.
- `tenders.procedure_type`: mapa CODICE `SyndicationTenderingProcessCode` 2.07 completo (corrige 4/5/6; añade 7–8, 10–13, 100, 999); desconocidos → `otro`; migración remapea slugs/números; etiquetas UI.
- `tenders.contract_type`: mapa CODICE `ContractCode` completo (7, 8=`privado`, 21, 22, 31, 32, 40, 50); desconocidos → `otro`; migración remapea literales numéricos ya guardados; etiquetas UI.
- `procedure_type` CODICE `9` → `abierto_simplificado` (normalize + migración de filas literales `"9"`; etiqueta UI).
- Favoritos y búsquedas guardadas: con más de 10 ítems, un solo panel con scroll interno en la lista y pager pegado al borde inferior del mismo panel; ≤10 sin controles de paginación.
- Favoritos: el selector de tamaño de página (10 / 50 / 100) abre hacia arriba; mismo esquema de paginación en búsquedas guardadas («búsquedas totales»).

### Fixed

- Login: validar `?next=` antes de redirigir (rechaza `//host` y similares; open redirect).
- Alertas: no crear/editar si importe mín. > máx. (mismo aviso que en búsqueda: «Importe solicitado inválido.»).
- Inicio: si falla alguna query de resumen, se muestra error en lugar de silenciarlo.
- Guardar búsqueda: una sola lectura de búsquedas propias para validar nombre y criterios duplicados (antes dos `listOwnSavedSearches`).
- Detección de búsquedas/alertas duplicadas: `criteriaEqual` ahora distingue también por estado, procedimiento, tipo de contrato y fechas de publicación (antes solo keywords/CPV/importes/geo/`open_for_submission` → falso positivo al guardar).
- Búsquedas guardadas: CCAA/municipio se reflejan en el resumen, en la detección de duplicados y al reabrir desde Favoritos (query `ccaa` / `municipality`).
- PLACSP / agregadas / menores: `ContractFolderStatusCode` se lee desde `cbc-place-ext` (Atom real); antes se buscaba solo en `cbc` → `tenders.status` siempre null. Fallback `cbc` + local-name + `Estado:` en `atom:title`.
- Euskadi: `deadlineDate` de `/contracting-notices` → `deadline_at` (antes siempre `None`). CPV de licitación sigue vacío en este endpoint (no mapear CPV del órgano).
- Cola de digests: tras un fallo de envío los ítems quedan en `failed` y el job los reintenta; umbral por clase de error (temporal `< 3`, gordo `< 2` intentos) y luego `cancelled`. Antes un único fallo dejaba la fila fuera del drain. Sin ADR (refinamiento operativo MVP).
- Ingesta Postgres: si el pipeline falla a mitad, se hace rollback del canónico pero **sí** queda `source_sync` en `failed` (transacción aparte); antes el rollback borraba también la bitácora ([ADR 003](docs/adr/003-acceso-canonico-publico-etl-privado.md) actualizado).

### Documentation

- BACKLOG §6: búsqueda `/search` limitada a 20 resultados a propósito; revisable más adelante.
- BACKLOG §2: al activar cron de ingestas, endurecer subida de ZIPs grandes a Storage (multipart/un paquete por job; no trocear RAW oficial).
- [ADR 018](docs/adr/018-geografia-lugar-ejecucion-ccaa-municipio.md): CCAA + municipio por códigos; sin provincia a corto plazo; geografía ≠ `source_code`.
- [ADR 017](docs/adr/017-tender-events-tipo-pipeline-y-status.md): `tender_events` separa `event_type` (`ingerida`\|`actualizada`) de `event_status` (snapshot de negocio); sin evento si la re-ingesta no cambia contenido.
- Checklist al añadir `source_code` nuevo: actualizar `SOURCE_PRIORITY` + [ADR 015](docs/adr/015-fuente-ganadora-canonica.md) (`docs/sources/README.md`, BACKLOG §4, `cobertura-ccaa.md`).
- BACKLOG §1: posible doble envío de digest si el job falla tras Resend — aceptado en MVP (preferir duplicado a pérdida); endurecer solo si es recurrente.
- Fichas PLACSP agregadas/menores alineadas al colapso por `atom:updated`; [ADR 003](docs/adr/003-acceso-canonico-publico-etl-privado.md) aclara bitácora `failed` tras rollback. Matching/reingesta documentados en `docs/plans/BACKLOG.md` (§ Hecho), no como ADR.

### Changed

- Vocabulario canónico de producto en español: `tenders.status` / `procedure_type` / `contract_type`, `users.digest_frequency` y `alerts.frequency` (`diaria`|`semanal`), `documents.document_type` (`publicacion`), `tender_events.event_status` alineado. Sin remap de `criteria` jsonb ni de `source_code`.
- `tender_events`: `event_type` pasa a hecho de pipeline (`ingerida` | `actualizada`); nuevo `event_status` con el status de negocio en ese momento. Sin fila nueva si la re-ingesta no cambia contenido (`last_seen_at` sigue bastando).
- Semana 6 UX: icono de buzón en cabecera (puntito de no leídas placeholder) + página `/notifications`.
- Semana 6: restaura RPC `search_tenders` Semana 5 (FTS+trgm) tras revertir la búsqueda ampliada; la UI solo oculta el badge «FTS» (sigue mostrando «errata»).
- Semana 6 Auth: acceso invite-only — landing sin nav con solo «Iniciar sesión»; sin registro público; búsqueda y rutas de producto exigen sesión; cambio de contraseña opcional al primer login ([ADR 016](docs/adr/016-auth-invite-only-sin-registro-publico.md)).
- Semana 6 UX: layout contenido `max-w-6xl`; frecuencia alertas alineada a la derecha. Buscador sigue con Texto / CPV / importes (la ampliación se revirtió).
- Semana 6 UX: «Limpiar campos» solo con criterios escritos; frecuencia de notificaciones editable en Alertas (toast de confirmación); licitaciones favoritas paginadas (10/pág).
- Semana 6 UX: soft undo al borrar búsqueda/alerta (toast + Revertir; × circular flotante); editar alerta con Cancelar junto a Guardar y Editar desactivado mientras se edita.
- Semana 6 UX: Favoritos hub (licitaciones + búsquedas guardadas con preview/Mostrar más); alertas con badge Activa/Inactiva; sin «Crear alerta» en búsqueda; búsquedas guardadas fuera de `/alerts`.
- Semana 6 UX: validación vacía al buscar; «volver» conserva filtros de búsqueda o vuelve a favoritos; corazón favorito en resultados; «Quitar de favoritos» outline destructivo; form de alertas con importe; nav sin «Inicio» (logo → home).
- Re-ingesta canónica: `tender_events` / `tenders.updated_at` solo si cambian campos de negocio; `tender_sources.last_seen_at` sigue marcando que la fuente la ha vuelto a ver.
- Matching multi-fuente: si ambas partes traen expediente y difiere → nunca `auto` (como mucho `pending`); evita fusionar contratos distintos del mismo NIF.
- Parser PLACSP: si el mismo expediente aparece varias veces en un ZIP/Atom, gana la entry con `atom:updated` más reciente (no el orden del fichero/XML).
- Semana 5: preferencia de digest de alertas a nivel de cuenta (`users.digest_frequency`: `daily` | `weekly`); un email por usuario/periodo; weekly envía solo lunes UTC; UI en `/account`; `instant` diferido (BACKLOG).
- Cierre Semana 5: checklist Fase 5 completo; búsqueda FTS/`pg_trgm` + Auth/RLS + alertas batch/digest Resend + CLI/workflow (cron off); [ADR 011](docs/adr/011-busqueda-via-rpc-search-tenders.md) (RPC `search_tenders`), [ADR 012](docs/adr/012-digest-email-job-python-sin-edge-function.md) (digest desde job Python), [ADR 013](docs/adr/013-alert-frequencies-daily-weekly-instant-diferido.md) (`daily`|`weekly`; `instant` diferido). Pendiente externo: dominio `eficen.com` en Resend. Siguiente: Semana 6 (UX/producto).
- Semana 5: badge de búsqueda — `match_kind=fts` solo si el texto escrito aparece como palabra en el título; si FTS encaja solo por stemming (p. ej. `fotocopiaas`) → `trgm` / errata.
- Semana 5: erratas de búsqueda con `strict_word_similarity` / `<<%` (menos ruido que `word_similarity`; p. ej. `foas` ya no liga a fotocopiadoras); se mantiene `similarity` / `%`.
- Semana 5: búsqueda de erratas cortas con `word_similarity` / `<%` en `search_tenders` (p. ej. `softwar` → títulos con “software”); se mantiene `similarity` / `%` para consultas más largas.
- Semana 5 Paso 10: recorrido E2E local (login → `/search` → `/alerts` → `run-alerts --write` Fake → cola `sent` + idempotencia); guía `docs/plans/semana05-e2e-local.md`; Resend verificado con correo personal.
- Semana 5 Paso 9: CLI `run-alerts` (dry-run por defecto) + `PostgresNotificationQueue` + workflow `alerts-digest.yml` (`workflow_dispatch`, cron off).
- Semana 5 Paso 8: digest diario/semanal de alertas (`drain_daily_digests`, preferencia de cuenta) + `ResendEmailSender` / `FakeEmailSender`; secretos `RESEND_API_KEY` / `ALERT_FROM_EMAIL` solo en entorno; sin reenvío de `sent`.
- Semana 5 Paso 7: motor batch de alertas en Python (`match` → `notification_queue` in-memory) con tests de matching e idempotencia; sin envío email (Paso 8).
- Semana 5 Paso 6: registro + UI `/alerts` (CRUD mínimo alertas/búsquedas) + script RLS Alice≠Bob (`verify:rls`); fondo web blanco fijo (brand en Semana 6).
- Semana 5 Paso 5: Auth SSR (`@supabase/ssr`, middleware), sync `auth.users` → `public.users` (trigger), login/account mínimos; seed perfiles Alice/Bob.
- Semana 5 Paso 4: UI mínima de búsqueda en `apps/web` (`/search`) sobre `searchTenders` (texto, CPV, importe; badge FTS/errata).
- Semana 5 Paso 3: capa `searchTenders` en `apps/web/src/lib/queries` + RPC `public.search_tenders` (FTS + `pg_trgm` + filtros Criteria v1); tipos regenerados.
- Semana 5 Paso 2: FTS en `tenders` (`search_vector` generated spanish A/B, GIN) + `pg_trgm` en `title`; tipos TS regenerados.
- Semana 5 Paso 1: contrato `criteria` v1 compartido para `alerts` / `saved_searches` (`packages/types/src/criteria.ts`, `efilicit_ingestion.alerts.criteria`) + comments SQL; sin DDL de columnas nuevas.
- Plan y checklist Semana 5 (`semana05-plan`, `fase5-checklist`): búsqueda + Auth + alertas; rama `tecnico4/semana-05`.
- Backlog general (`docs/plans/BACKLOG.md`): catálogo de aplazados / N/A / mejoras posibles sacadas del plan (sin el alcance de la semana siguiente); incluye `setup_rls_smoke` como andamiaje Fase 0 aún usado en health-check.
- Plan y checklist Semana 4 (`semana04-plan`, `fase4-checklist`): cobertura territorial 17 CCAA + deduplicación; leftover `placsp_menores`; rama `tecnico4/semana-04`.
- Semana 4 Paso 1: cobertura 17 CCAA en `docs/sources/cobertura-ccaa.md` (2 propias + 5 agregación + 10 perfiles alojados `placsp`); ficha `placsp_menores.md`; 0 CCAA propias extra. Plan sin duplicar fichas (solo decisiones breves).
- Semana 4 Paso 2.2: `PLACSP_MENORES` (`sindicacion_1143`) en discover/fetch con tests sin red.
- Semana 4 Paso 2.3: RAW Storage `raw/placsp_menores/`, parse/normalize/upsert canónico e idempotente para menores (tests sin red).
- Semana 4 Paso 2.4: CLI `run-placsp --syndication placsp_menores` + workflow `ingest-placsp.yml` (dry-run default, cron off).
- Semana 4 Paso 4: migración `tender_sources` con `match_method`, `match_score`, `matched_at`, `review_status` (`unmatched`/`auto`/`pending`); tipos TS regenerados.
- Semana 4 Paso 5: matching multi-fuente en pipeline (`stages.deduplicate` + `MatchLookup`); anota `payload['match']` (`auto`/`pending`/`unmatched`); tests sin red.
- Semana 4 Paso 6: upsert respeta matching (`auto` reutiliza `tenders.id`; `pending`/`unmatched` crean fila; idempotente en `(source_code, source_tender_id)`).
- Semana 4 Paso 7: fixtures de solape PLACSP↔Euskadi (`fixtures/overlap/`) + tests de auto-merge / no-merge / regresión Catalunya sin NIF; batería ingestion en verde.
- Cierre Semana 4: checklist Fase 4 completo; catálogo de fuentes actualizado; cobertura 17 CCAA + `placsp_menores` + dedup multi-fuente; [ADR 009](docs/adr/009-ccaa-propia-extra-na-semana4.md) (CCAA extra N/A), [ADR 010](docs/adr/010-match-candidate-tender-id-en-tender-sources.md) (candidato best). Siguiente: Semana 5 (búsqueda + Auth + alertas).
- Documentación base de onboarding, arquitectura, setup, reglas Cursor y roadmap MVP.
- Cimientos del monorepo: `.gitignore`, `.env.example`, `package.json`, `pnpm-workspace.yaml`, árbol de carpetas y guías `README` / `CONTRIBUTING`.
- Reglas Cursor en `.cursor/rules/` (`00`–`08`) según `docs/03-reglas-cursor.md`.
- Scaffold frontend `@efilicit/web` (Next.js + TypeScript + Tailwind) y paquete `@efilicit/types`.
- Scaffold Python `@efilicit` ingestion (`efilicit_ingestion` CLI mínimo con `uv`).
- Inicialización de `supabase/` y stack local (Docker) para desarrollo.
- Workflow CI mínimo en GitHub Actions (lint/typecheck/build web + smoke CLI ingestion).
- Migración local Fase 0: bucket Storage `raw` + tabla RLS smoke `setup_rls_smoke` + seed sintético (Alice/Bob).
- Proyecto Supabase remoto EfiLicit vinculado (`luvxqyajujlznocflymo`); major PostgreSQL 17 alineada; migración Fase 0 aplicada en remoto.
- Cierre Fase 0: `.env.local` web, tipos generados, checklist de Fase 0, smoke de consulta a Supabase local.
- Carpeta `docs/plans/`: planes y checklists por semana (`semana00-plan`, `semana01-plan`, `fase0-checklist` movido desde `docs/`, `fase1-checklist`).
- Migración Semana 1 (Paso 1): tablas operativas `source_sync`, `source_artifacts`, `errors` con RLS restringido a procesos confiables.
- Migración Semana 1 (Paso 2): núcleo canónico mínimo (`tenders`, `tender_sources`, `tender_events`, `contracting_authorities`, `suppliers`, `documents`) con lectura pública y escritura ETL.
- Migración Semana 1 (Paso 3): esqueleto `users`, `saved_searches`, `alerts`, `notification_queue` con RLS por propietario.
- Tipos TypeScript regenerados desde Supabase local tras el esquema Semana 1 (Pasos 1–3).
- Contrato Python `SourceConnector` (`discover` / `fetch` / `parse`), modelos Pydantic y stub con tests de contrato.
- Pipeline común mínimo (`run_pipeline`) con etapas del roadmap, `store_raw` (checksum + path) y prueba con stub in-memory.
- Persistencia Postgres de `source_sync` / `source_artifacts` vía `psycopg` (cliente SQL de ETL) + tests de integración locales.
- CI de ingestion: además del smoke `--help`, ejecuta `pytest` (`uv sync --extra dev`).
- Cierre Semana 1: checklist completo; [ADR 003](docs/adr/003-acceso-canonico-publico-etl-privado.md) (canónico público / ETL privado), [ADR 004](docs/adr/004-ci-ingestion-sin-postgres.md) (CI sin Postgres).
- Plan y checklist Semana 2 (`semana02-plan`, `fase2-checklist`): PLACSP vertical slice.
- Catálogo de fuentes: ficha `docs/sources/placsp.md` (sindicación `643`, Atom/CODICE, acceso Open Data sin scraping).
- Conector PLACSP `discover`: paquetes mensuales ZIP por URI conocidas, `artifact_key` estable y tests sin red.
- Conector PLACSP `fetch`: timeout, reintentos (`tenacity`), límite de tamaño y checksum SHA-256 determinista.
- Persistencia RAW: `SupabaseStorageArtifactStore` (bucket `raw`) + registro en `source_artifacts` vía `fetch_validate_and_store_raw`.
- Parser PLACSP Atom/CODICE (`lxml`) con fixtures anonimizadas y `source_record_id` estable documentado.
- Normalización canónica + identidad de organismos (`identity_confidence` con NIF/CIF prioritario).
- Upsert canónico en Postgres (`tenders`, `tender_sources`, `tender_events`, `documents`) con reejecución idempotente.
- CLI `run-placsp`: pipeline PLACSP E2E local con `--fixture` / `--dry-run` (y escritura a Supabase local).
- Workflow GitHub Actions `ingest-placsp.yml`: ingesta PLACSP manual (`dry-run` / `fixture-db` / `live`); cron desactivado; secretos fuera del código.
- Cierre Semana 2: checklist Fase 2 completo; [ADR 005](docs/adr/005-ingesta-actions-manual-first-cron-off.md) (cron off / manual-first), [ADR 006](docs/adr/006-raw-storage-httpx-sin-supabase-py.md) (Storage vía httpx).
- Documento `docs/pruebas.md`: verificación local E2E con datos reales — `placsp` (Semana 2), `placsp_agregadas`, `catalunya` (8.6) y `euskadi` (9.5); RAW → canónico + idempotencia.
- Semana 3 Paso 8.6: verificación live SODA `catalunya` (1 página × 1000 + idempotencia) documentada en `docs/pruebas.md` Parte C.
- Semana 3 Paso 9.5: verificación live API `euskadi` (1 página × 10 + idempotencia) documentada en `docs/pruebas.md` Parte D.
- Plan y checklist Semana 3 (`semana03-plan`, `fase3-checklist`): escalado estatal + primeras CCAA.
- Semana 3 Paso 1: inventario priorizado (estatal `placsp_agregadas` → `placsp_menores`; cola CCAA `catalunya` → `euskadi` + reservas).
- Semana 3 Paso 2: ficha `docs/sources/placsp_agregadas.md` (sindicación `1044`, Atom/CODICE, sin scraping).
- Semana 3 Paso 3.1: `PlacspSyndication` + discover parametrizado para `placsp_agregadas` (tests sin red).
- Semana 3 Paso 3.2: fetch `placsp_agregadas` reutiliza `download_bytes` (tests sin red sobre URL `sindicacion_1044`).
- Semana 3 Paso 4.1: validate + RAW Storage para `placsp_agregadas` (prefijo `raw/placsp_agregadas/`, tests sin red).
- Semana 3 Paso 4.2: parse Atom/CODICE para `placsp_agregadas` reutilizando el parser PLACSP (tests sin red).
- Semana 3 Paso 4.3: normalize + identidad para `placsp_agregadas` reutilizando etapas del pipeline común (tests sin red).
- Semana 3 Paso 4.4: upsert canónico + `source_sync` + trazabilidad para `placsp_agregadas` (idempotente; tests sin red + Postgres opcional).
- Semana 3 Paso 4.5: CLI `run-placsp --syndication placsp_agregadas` con `--fixture` / `--dry-run` (E2E local sin red PLACSP).
- Semana 3 Paso 5: workflow `ingest-placsp.yml` admite `syndication=placsp_agregadas` (manual, dry-run por defecto, cron off).
- Semana 3 Paso 7: adaptador REST/Socrata (`SocrataConnector`) + preset `catalunya` (`ybgg-dgi6`); ficha y tests sin red.
- Semana 3 Paso 8.1: ficha `docs/sources/catalunya.md` ampliada al alcance E2E CCAA #1 (minipasos 8.2–8.5).
- Semana 3 Paso 8.2: validate + RAW Storage para `catalunya` (prefijo `raw/catalunya/`, tests sin red).
- Semana 3 Paso 8.3: upsert canónico + `source_sync` + trazabilidad para `catalunya` (idempotente; tests sin red + Postgres opcional).
- Semana 3 Paso 8.4: CLI `run-catalunya` con `--fixture` / `--dry-run` (E2E local sin red SODA).
- Semana 3 Paso 8.5: workflow `ingest-catalunya.yml` (manual, dry-run por defecto, cron off).
- Semana 3 Paso 9: CCAA #2 `euskadi` — conector KontratazioA REST (`contracting-notices`), ficha, RAW `raw/euskadi/`, CLI `run-euskadi`, workflow `ingest-euskadi.yml`, tests sin red; live en Paso 9.5 / `docs/pruebas.md` Parte D.
- Cierre Semana 3: checklist Fase 3 completo; catálogo de fuentes homogeneizado; regresión ingestion `112 passed`; [ADR 007](docs/adr/007-adaptador-csv-familia-na-semana3.md) (CSV familia N/A), [ADR 008](docs/adr/008-placsp-menores-aplazado-semana4.md) (`placsp_menores` → Semana 4). Resto de CCAA → Semana 4+.

### Changed

- Semana 4 (ajuste tras pruebas live): el matching en `tender_sources` ahora persiste `match_candidate_tender_id` — candidato best cuando `review_status=pending` (Studio / revisión humana futura); `auto`/`unmatched` → null; re-ingesta actualiza el best si sigue `pending` ([ADR 010](docs/adr/010-match-candidate-tender-id-en-tender-sources.md)). Evolución prevista: tabla `match_suggestions` (N candidatos) cuando exista UI de revisión.
- Decisión documentada: no aplicar branch protection en `main` por ahora (repo privado de prueba; no se contratará plan GitHub Team solo para ese bloqueo). [ADR 001](docs/adr/001-proteccion-main-aplazada.md); ver `.github/README.md`.
