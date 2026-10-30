-- Rollback de 20261030120000 en remoto (aplicado por error).
-- Deshace tablas/función del pipeline Mis licitaciones.
-- En local de desarrollo: NO ejecutar el DROP si quieres seguir probando la feature;
-- marcar esta versión como applied con:
--   npx supabase migration repair --local --status applied 20261030130100
-- (la creación ya está en 20261030120000).

drop table if exists public.bid_case_documents cascade;
drop table if exists public.bid_case_checklist_items cascade;
drop table if exists public.bid_case_updates cascade;
drop table if exists public.bid_documents cascade;
drop table if exists public.bid_cases cascade;

drop function if exists public.bid_documents_set_updated_at();
drop function if exists public.bid_cases_set_updated_at();
drop function if exists public.is_app_user();
