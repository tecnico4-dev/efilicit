-- Wipe operativo de datos de aplicación (NO es migración de esquema).
--
-- Conserva:
--   auth.users
--   public.users          (cuentas / perfiles)
--   public.geo_ccaa
--   public.geo_municipio
--
-- Vacía: dominio canónico, sync/RAW metadata, alertas, favoritos,
-- colas/lecturas de notificación y tabla smoke de RLS.
--
-- Uso (remoto linkado):
--   npx supabase db query --linked -f scripts/wipe_app_data.sql
--
-- Uso (URI directa, p. ej. pooler):
--   npx supabase db query --db-url "$EFILICIT_DATABASE_URL" -f scripts/wipe_app_data.sql
--
-- Ver runbook: docs/runbooks/wipe-app-data.md

begin;

truncate table
  public.notification_reads,
  public.notification_trash,
  public.notification_queue,
  public.favorites,
  public.alerts,
  public.saved_searches,
  public.tender_cpvs,
  public.tender_events,
  public.tender_sources,
  public.documents,
  public.tenders,
  public.contracting_authorities,
  public.suppliers,
  public.source_artifacts,
  public.source_sync,
  public.errors,
  public.setup_rls_smoke
restart identity cascade;

commit;

-- Verificación (debe devolver 0 en tablas vaciadas; users/geo > 0)
select 'users' as relation, count(*)::bigint as n from public.users
union all select 'geo_ccaa', count(*) from public.geo_ccaa
union all select 'geo_municipio', count(*) from public.geo_municipio
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
union all select 'notification_queue', count(*) from public.notification_queue
union all select 'notification_reads', count(*) from public.notification_reads
union all select 'notification_trash', count(*) from public.notification_trash
union all select 'setup_rls_smoke', count(*) from public.setup_rls_smoke
order by 1;
