-- Semana 6 UX: separar buscador global (FTS search_vector) de filtro por título (trgm).
-- Criteria v1: p_query + p_keywords = global; p_title_query = solo título.
-- Filtros status / fechas / authority ya existían; la UI los expone ahora.
--
-- IMPORTANTE: añadir un argumento crea otra sobrecarga si no se borra la firma anterior.
-- DROP de la firma Semana 5 (sin p_title_query) antes del CREATE.

drop function if exists public.search_tenders(
  text, text[], text[], text[], uuid[], text, text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, integer, integer
);

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
  p_offset integer default 0,
  p_title_query text default null
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
  g as (
    select nullif(
      trim(
        both from concat_ws(
          ' ',
          nullif(trim(both from coalesce(p_query, '')), ''),
          nullif(array_to_string(p_keywords, ' '), '')
        )
      ),
      ''
    ) as global_q
  ),
  tq as (
    select nullif(trim(both from coalesce(p_title_query, '')), '') as title_q
  ),
  base as (
    select
      t.*,
      case
        when (select global_q from g) is null and (select title_q from tq) is null
          then 0::real
        else greatest(
          case
            when (select global_q from g) is null then 0::real
            else ts_rank(
              t.search_vector,
              plainto_tsquery('spanish', (select global_q from g))
            )
          end,
          case
            when (select title_q from tq) is null then 0::real
            else greatest(
              similarity(t.title, (select title_q from tq)),
              strict_word_similarity((select title_q from tq), t.title)
            )
          end
        )
      end as rank_score,
      (
        (select global_q from g) is not null
        and t.search_vector @@ plainto_tsquery('spanish', (select global_q from g))
      ) as fts_hit,
      (
        (select title_q from tq) is not null
        and (
          (select title_q from tq) <<% t.title
          or t.title % (select title_q from tq)
        )
      ) as trgm_hit,
      (
        (select title_q from tq) is not null
        and not exists (
          select 1
          from regexp_split_to_table(lower((select title_q from tq)), '[^[:alnum:]]+') as qw(word)
          where qw.word <> ''
            and not exists (
              select 1
              from regexp_split_to_table(lower(t.title), '[^[:alnum:]]+') as tw(word)
              where tw.word = qw.word
            )
        )
      ) as literal_title_hit
    from public.tenders t
    left join public.contracting_authorities ca
      on ca.id = t.contracting_authority_id
    where
      (
        (select global_q from g) is null
        or t.search_vector @@ plainto_tsquery('spanish', (select global_q from g))
      )
      and (
        (select title_q from tq) is null
        or (select title_q from tq) <<% t.title
        or t.title % (select title_q from tq)
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
    case
      when (select global_q from g) is null and (select title_q from tq) is null
        then 'filter'
      when (select title_q from tq) is not null and b.literal_title_hit
        then 'fts'
      when (select title_q from tq) is not null and b.trgm_hit
        then 'trgm'
      when b.fts_hit
        then 'fts'
      else 'filter'
    end as match_kind
  from base b
  order by
    b.rank_score desc,
    b.publication_date desc nulls last,
    b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.search_tenders(
  text, text[], text[], text[], uuid[], text, text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, integer, integer, text
) is
  'Semana 6: p_query/p_keywords = FTS global (search_vector); p_title_query = título (trgm). '
  'Filtros Criteria v1. match_kind: fts/trgm/filter.';

revoke all on function public.search_tenders(
  text, text[], text[], text[], uuid[], text, text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, integer, integer, text
) from public;

grant execute on function public.search_tenders(
  text, text[], text[], text[], uuid[], text, text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, integer, integer, text
) to anon, authenticated;

-- Distinct statuses for search UI (avoid scanning all tender rows in the app).
create or replace function public.list_tender_statuses()
returns setof text
language sql
stable
security invoker
set search_path = public
as $$
  select distinct t.status
  from public.tenders t
  where t.status is not null
    and trim(t.status) <> ''
  order by 1;
$$;

comment on function public.list_tender_statuses is
  'Valores distintos de tenders.status para el select de búsqueda.';

revoke all on function public.list_tender_statuses from public;
grant execute on function public.list_tender_statuses to anon, authenticated;
