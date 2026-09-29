-- Semana 5 / Paso 3: RPC de búsqueda canónica (FTS + pg_trgm + filtros).
-- La web llama a esta función vía apps/web/src/lib/queries (sin motor externo).
-- SECURITY INVOKER: aplica RLS de tenders / contracting_authorities.

create or replace function public.search_tenders(
  p_query text default null,
  p_keywords text[] default null,
  p_cpv_codes text[] default null,
  p_authority_tax_ids text[] default null,
  p_authority_ids uuid[] default null,
  p_authority_name_contains text default null,
  p_municipalities text[] default null,
  p_countries text[] default null,
  p_estimated_value_min numeric default null,
  p_estimated_value_max numeric default null,
  p_contract_types text[] default null,
  p_procedure_types text[] default null,
  p_statuses text[] default null,
  p_publication_date_from date default null,
  p_publication_date_to date default null,
  p_deadline_from timestamptz default null,
  p_deadline_to timestamptz default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  status text,
  procedure_type text,
  contract_type text,
  estimated_value numeric,
  currency text,
  cpv_code text,
  publication_date date,
  deadline_at timestamptz,
  contracting_authority_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  rank real,
  match_kind text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with
  q as (
    select nullif(
      trim(
        both from concat_ws(
          ' ',
          nullif(trim(both from coalesce(p_query, '')), ''),
          nullif(array_to_string(p_keywords, ' '), '')
        )
      ),
      ''
    ) as text_q
  ),
  base as (
    select
      t.*,
      case
        when (select text_q from q) is null then 0::real
        else greatest(
          ts_rank(
            t.search_vector,
            plainto_tsquery('spanish', (select text_q from q))
          ),
          similarity(t.title, (select text_q from q))
        )
      end as rank_score,
      case
        when (select text_q from q) is null then 'filter'
        when t.search_vector @@ plainto_tsquery('spanish', (select text_q from q))
          then 'fts'
        when t.title % (select text_q from q)
          then 'trgm'
        else 'filter'
      end as kind
    from public.tenders t
    left join public.contracting_authorities ca
      on ca.id = t.contracting_authority_id
    where
      (
        (select text_q from q) is null
        or t.search_vector @@ plainto_tsquery('spanish', (select text_q from q))
        or t.title % (select text_q from q)
      )
      and (
        p_cpv_codes is null
        or exists (
          select 1
          from unnest(p_cpv_codes) as c(code)
          where t.cpv_code is not null
            and t.cpv_code like c.code || '%'
        )
      )
      and (
        p_authority_tax_ids is null
        or ca.tax_id = any (p_authority_tax_ids)
      )
      and (
        p_authority_ids is null
        or ca.id = any (p_authority_ids)
      )
      and (
        p_authority_name_contains is null
        or ca.name_normalized ilike '%' || p_authority_name_contains || '%'
        or ca.name ilike '%' || p_authority_name_contains || '%'
      )
      and (
        p_municipalities is null
        or lower(ca.municipality) = any (
          select lower(m) from unnest(p_municipalities) as m
        )
      )
      and (
        p_countries is null
        or ca.country = any (p_countries)
      )
      and (
        p_estimated_value_min is null
        or t.estimated_value >= p_estimated_value_min
      )
      and (
        p_estimated_value_max is null
        or t.estimated_value <= p_estimated_value_max
      )
      and (
        p_contract_types is null
        or t.contract_type = any (p_contract_types)
      )
      and (
        p_procedure_types is null
        or t.procedure_type = any (p_procedure_types)
      )
      and (
        p_statuses is null
        or t.status = any (p_statuses)
      )
      and (
        p_publication_date_from is null
        or t.publication_date >= p_publication_date_from
      )
      and (
        p_publication_date_to is null
        or t.publication_date <= p_publication_date_to
      )
      and (
        p_deadline_from is null
        or t.deadline_at >= p_deadline_from
      )
      and (
        p_deadline_to is null
        or t.deadline_at <= p_deadline_to
      )
  )
  select
    b.id,
    b.title,
    b.description,
    b.status,
    b.procedure_type,
    b.contract_type,
    b.estimated_value,
    b.currency,
    b.cpv_code,
    b.publication_date,
    b.deadline_at,
    b.contracting_authority_id,
    b.created_at,
    b.updated_at,
    b.rank_score as rank,
    b.kind as match_kind
  from base b
  order by
    b.rank_score desc,
    b.publication_date desc nulls last,
    b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.search_tenders is
  'Semana 5: búsqueda canónica FTS (spanish) + pg_trgm en title + filtros Criteria v1. '
  'Llamar desde apps/web/src/lib/queries.';

revoke all on function public.search_tenders from public;
grant execute on function public.search_tenders to anon, authenticated;
