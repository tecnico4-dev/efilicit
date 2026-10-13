-- Revert Semana 6 UX de búsqueda ampliada: restaurar search_tenders previo
-- (FTS + trgm unificados en p_query/p_keywords) y quitar list_tender_statuses.

drop function if exists public.list_tender_statuses();

-- Firma con p_title_query (migración experimental Semana 6), si existiera.
drop function if exists public.search_tenders(
  text, text[], text[], text[], uuid[], text, text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, integer, integer, text
);

-- Firma previa (sin p_title_query) para recrear limpia.
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
          similarity(t.title, (select text_q from q)),
          strict_word_similarity((select text_q from q), t.title)
        )
      end as rank_score,
      (
        (select text_q from q) is not null
        and t.search_vector @@ plainto_tsquery('spanish', (select text_q from q))
      ) as fts_hit,
      (
        (select text_q from q) is not null
        and (
          (select text_q from q) <<% t.title
          or t.title % (select text_q from q)
        )
      ) as trgm_hit,
      (
        (select text_q from q) is not null
        and not exists (
          select 1
          from regexp_split_to_table(lower((select text_q from q)), '[^[:alnum:]]+') as qw(word)
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
        (select text_q from q) is null
        or t.search_vector @@ plainto_tsquery('spanish', (select text_q from q))
        or (select text_q from q) <<% t.title
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
    case
      when (select text_q from q) is null then 'filter'
      when b.fts_hit and b.literal_title_hit then 'fts'
      when b.fts_hit or b.trgm_hit then 'trgm'
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

comment on function public.search_tenders is
  'Semana 5: FTS + pg_trgm (strict_word_similarity/<<%, similarity/%) + filtros Criteria v1. '
  'match_kind=fts solo si cada token de la consulta aparece literalmente en el título; '
  'si FTS encaja solo por stemming → trgm (UI errata). Restaurado tras revert UX búsqueda ampliada.';

revoke all on function public.search_tenders from public;
grant execute on function public.search_tenders to anon, authenticated;
