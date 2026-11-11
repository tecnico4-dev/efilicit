-- Wipe operativo de datos de aplicación (NO es migración de esquema).
--
-- Conserva:
--   auth.users
--   public.users          (cuentas / perfiles)
--   public.geo_ccaa
--   public.geo_municipio
--   public.offer_* / public.company_*  (Mis licitaciones)
--   public.tenders (+ deps canónicas) referenciados por offer_cases
--     → ON DELETE RESTRICT / ADR 028: no se borran ni se desvinculan
--
-- Vacía: resto del dominio canónico, sync/RAW metadata, alertas, favoritos,
-- colas/lecturas de notificación.
--
-- Uso (remoto linkado):
--   npx supabase db query --linked -f scripts/wipe_app_data.sql
--
-- Uso (URI directa, p. ej. pooler):
--   npx supabase db query --db-url "$EFILICIT_DATABASE_URL" -f scripts/wipe_app_data.sql
--
-- Ver runbook: docs/runbooks/wipe-app-data.md

begin;

-- Producto usuario (no toca offer_*)
truncate table
  public.recent_searches,
  public.notification_emails,
  public.notification_favorites,
  public.notification_queue,
  public.tender_ratings,
  public.favorites,
  public.alerts,
  public.saved_searches
restart identity cascade;

-- Sync / errores (metadatos batch; no dependen de offer_cases)
truncate table
  public.source_artifacts,
  public.source_sync,
  public.errors
restart identity cascade;

-- Canónico: borrar solo licitaciones que NO están en Mis licitaciones
-- (offer_cases.tender_id es RESTRICT → no usar TRUNCATE tenders CASCADE)
delete from public.tender_cpvs
where tender_id not in (select tender_id from public.offer_cases);

delete from public.tender_events
where tender_id not in (select tender_id from public.offer_cases);

delete from public.tender_sources
where tender_id not in (select tender_id from public.offer_cases);

delete from public.documents
where tender_id not in (select tender_id from public.offer_cases);

delete from public.tenders
where id not in (select tender_id from public.offer_cases);

-- Organismos huérfanos (siguen referenciados por tenders protegidos)
delete from public.contracting_authorities ca
where not exists (
  select 1 from public.tenders t where t.contracting_authority_id = ca.id
);

-- suppliers: sin FK desde canónico actual → se vacía entero
truncate table public.suppliers restart identity cascade;

commit;

-- Verificación
select 'users' as relation, count(*)::bigint as n from public.users
union all select 'geo_ccaa', count(*) from public.geo_ccaa
union all select 'geo_municipio', count(*) from public.geo_municipio
union all select 'offer_cases', count(*) from public.offer_cases
union all select 'tenders', count(*) from public.tenders
union all select 'tender_sources', count(*) from public.tender_sources
union all select 'tender_events', count(*) from public.tender_events
union all select 'tender_cpvs', count(*) from public.tender_cpvs
union all select 'documents', count(*) from public.documents
union all select 'contracting_authorities', count(*) from public.contracting_authorities
union all select 'suppliers', count(*) from public.suppliers
union all select 'source_sync', count(*) from public.source_sync
union all select 'source_artifacts', count(*) from public.source_artifacts
union all select 'errors', count(*) from public.errors
union all select 'alerts', count(*) from public.alerts
union all select 'saved_searches', count(*) from public.saved_searches
union all select 'favorites', count(*) from public.favorites
union all select 'tender_ratings', count(*) from public.tender_ratings
union all select 'notification_queue', count(*) from public.notification_queue
union all select 'notification_favorites', count(*) from public.notification_favorites
union all select 'notification_emails', count(*) from public.notification_emails
union all select 'recent_searches', count(*) from public.recent_searches
order by 1;
