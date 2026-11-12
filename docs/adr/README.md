# Architecture Decision Records

Decisiones de impacto (seguridad, contratos, esquema, orquestación, excepciones a la arquitectura fija) se registran aquí.

**Convención de nombre:** `NNN-titulo-en-kebab-case.md` (numeración correlativa).  
**Plantilla mínima:** Estado · Contexto · Decisión (con alternativas descartadas) · Consecuencias · Riesgos · Fecha · Referencias.

Los ADR **no se reescriben** si cambia la decisión: se marca `Reemplazado por: NNN` y se escribe uno nuevo. La historia no se borra.

No uses un ADR para el estado de una fuente o un parser: eso va en `docs/sources/`.

## Índice

| ADR | Título | Estado |
|---|---|---|
| [001](001-proteccion-main-aplazada.md) | Protección de `main` aplazada (GitHub Free / repo privado) | Aceptado |
| [002](002-bootstrap-supabase-remoto-greenfield.md) | Bootstrap Supabase remoto greenfield (`db push`, no `db pull`) | Aceptado |
| [003](003-acceso-canonico-publico-etl-privado.md) | Acceso Semana 1: canónico público, ETL privado (`errors` reservada) | Aceptado |
| [004](004-ci-ingestion-sin-postgres.md) | CI de ingestion sin Postgres (tests de DB en skip) | Aceptado |
| [005](005-ingesta-actions-manual-first-cron-off.md) | Ingesta en Actions: manual-first (cron desactivado) | Aceptado |
| [006](006-raw-storage-httpx-sin-supabase-py.md) | RAW Storage vía `httpx` + `service_role` (sin `supabase-py`) | Aceptado |
| [007](007-adaptador-csv-familia-na-semana3.md) | Adaptador CSV de familia: N/A en Semana 3 | Aceptado |
| [008](008-placsp-menores-aplazado-semana4.md) | `placsp_menores` aplazado a Semana 4+ | Aceptado |
| [009](009-ccaa-propia-extra-na-semana4.md) | CCAA propia extra: N/A en Semana 4 | Aceptado |
| [010](010-match-candidate-tender-id-en-tender-sources.md) | Candidato best de matching en `tender_sources` | Aceptado |
| [011](011-busqueda-via-rpc-search-tenders.md) | Búsqueda canónica vía RPC `search_tenders` (SECURITY INVOKER) | Aceptado |
| [012](012-digest-email-job-python-sin-edge-function.md) | Digest de alertas: envío desde job Python (Edge Function N/A) | Aceptado |
| [013](013-alert-frequencies-daily-weekly-instant-diferido.md) | Frecuencias MVP `daily`\|`weekly`; `instant` diferido | Aceptado |
| [014](014-upsert-organismos-por-platform-id.md) | Upsert de organismos por `platform_id` cuando no hay NIF/CIF | Aceptado |
| [015](015-fuente-ganadora-canonica.md) | Fuente ganadora canónica (ranking fijo, sin mezcla de campos) | Aceptado |
| [016](016-auth-invite-only-sin-registro-publico.md) | Auth invite-only: sin registro público ni búsqueda anónima en UI | Aceptado |
| [017](017-tender-events-tipo-pipeline-y-status.md) | `tender_events`: hecho de pipeline vs estado de negocio | Aceptado |
| [018](018-geografia-lugar-ejecucion-ccaa-municipio.md) | Geografía lugar de ejecución: CCAA + municipio (sin provincia) | Aceptado |
| [019](019-tender-cpvs-multivalor.md) | CPV multivalor en `tender_cpvs` (sin columna en `tenders`) | Aceptado |
| [020](020-alertas-match-post-ingesta-y-digest-diario.md) | Alertas: match post-ingesta + digest diario; despertador = cron externo → `workflow_dispatch` | Aceptado |
| [021](021-raw-storage-tus-resumable-httpx.md) | RAW Storage: TUS resumable vía `httpx` (ZIP intacto; umbral 6 MiB) | Aceptado |
| [022](022-placsp-raw-entry-incremental.md) | PLACSP RAW incremental por entry Atom (sin ZIP entero en Storage) | Aceptado |
| [022](022-digest-email-inbox-in-app.md) | Digest email → aviso in-app en el buzón (1 = 1 correo) | Aceptado |
| [023](023-mis-licitaciones-pipeline-compartido.md) | Mis licitaciones: pipeline de presentación compartido (Eficen) | Aceptado |
| [024](024-drop-tender-sources-last-seen.md) | Eliminar `tender_sources.last_seen_at` (+ RPC `tender_max_last_seen`) | Aceptado |
| [025](025-catalunya-raw-row-incremental.md) | CCAA RAW incremental por unidad (Catalunya + Euskadi; extiende 022) | Aceptado |
| [026](026-mis-licitaciones-offer-cases.md) | Mis licitaciones: expediente de oferta (`offer_*`; extiende 023) | Aceptado |
| [027](027-offer-schema-hardening-is-app-user.md) | Endurecimiento oferta: `is_app_user` + cadena migraciones (bloque A) | Aceptado |
| [028](028-offer-schema-block-b-integrity.md) | Endurecimiento oferta (bloque B): RESTRICT + evidencias + FK compuestas | Aceptado |
| [029](029-shared-favorites-comun.md) | Favoritos Común (`shared_favorites`) | Aceptado |
