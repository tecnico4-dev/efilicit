-- Opciones de desplegables de búsqueda: DISTINCT de vocabulario/CCAA en tenders.
-- SECURITY INVOKER → misma RLS de lectura canónica (anon/authenticated).

create or replace function public.list_tender_filter_options()
returns table (
  kind text,
  value text
)
language sql
stable
security invoker
set search_path = public
as $$
  select 'status'::text as kind, s.status as value
  from (
    select distinct status
    from public.tenders
    where status is not null
  ) s
  union all
  select 'procedure_type', p.procedure_type
  from (
    select distinct procedure_type
    from public.tenders
    where procedure_type is not null
  ) p
  union all
  select 'contract_type', c.contract_type
  from (
    select distinct contract_type
    from public.tenders
    where contract_type is not null
  ) c
  union all
  select 'place_ccaa_code', g.place_ccaa_code
  from (
    select distinct place_ccaa_code
    from public.tenders
    where place_ccaa_code is not null
  ) g;
$$;

comment on function public.list_tender_filter_options() is
  'Valores distintos de status / procedure_type / contract_type / place_ccaa_code '
  'para filtros de /search. kind discrimina la dimensión.';

revoke all on function public.list_tender_filter_options() from public;
grant execute on function public.list_tender_filter_options() to anon, authenticated;
