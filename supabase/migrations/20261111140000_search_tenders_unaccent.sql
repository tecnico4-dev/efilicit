-- FTS sin tildes: buscar «Aviles» o «Avilés» igual.
-- title/description se siguen guardando con tildes; solo el índice FTS las ignora.

create extension if not exists unaccent with schema extensions;

-- unaccent() es STABLE; wrapper IMMUTABLE para columna generada (patrón habitual).
create or replace function public.f_unaccent(txt text)
returns text
language sql
immutable
parallel safe
strict
set search_path = extensions, public
as $$
  select extensions.unaccent(txt);
$$;

comment on function public.f_unaccent(text) is
  'Unaccent inmutable para FTS (search_vector + search_tenders). No altera columnas de texto.';

revoke all on function public.f_unaccent(text) from public;
grant execute on function public.f_unaccent(text) to anon, authenticated;

drop index if exists public.tenders_search_vector_gin_idx;

alter table public.tenders drop column if exists search_vector;

alter table public.tenders
  add column search_vector tsvector
  generated always as (
    setweight(
      to_tsvector('spanish', coalesce(public.f_unaccent(title), '')),
      'A'
    )
    || setweight(
      to_tsvector('spanish', coalesce(public.f_unaccent(description), '')),
      'B'
    )
  ) stored;

comment on column public.tenders.search_vector is
  'FTS: título A + descripción B (spanish), sin tildes vía f_unaccent. title/description intactos.';

create index tenders_search_vector_gin_idx
  on public.tenders using gin (search_vector);

-- Recrear RPC con query también sin tildes (y literal_title_hit coherente).
drop function if exists public.search_tenders(
  text, text[], text[], text, text[], uuid[], text, text[], text[], text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, boolean, integer, integer, bigint
);

drop function if exists public.search_tenders(
  text, text[], text[], text, text[], uuid[], text, text[], text[], text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, boolean, integer, integer, bigint, text, text
);

create function public.search_tenders(
  p_query text default null,
  p_keywords text[] default null,
  p_cpv_codes text[] default null,
  p_cpv_match text default 'any',
  p_authority_tax_ids text[] default null,
  p_authority_ids uuid[] default null,
  p_authority_name_contains text default null,
  p_municipalities text[] default null,
  p_countries text[] default null,
  p_ccaa_codes text[] default null,
  p_municipality_codes text[] default null,
  p_estimated_value_min numeric default null,
  p_estimated_value_max numeric default null,
  p_contract_types text[] default null,
  p_procedure_types text[] default null,
  p_statuses text[] default null,
  p_publication_date_from date default null,
  p_publication_date_to date default null,
  p_deadline_from timestamptz default null,
  p_deadline_to timestamptz default null,
  p_open_for_submission boolean default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_known_total bigint default null,
  p_sort_by text default null,
  p_sort_dir text default null
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
  cpv_codes text[],
  publication_date date,
  deadline_at timestamptz,
  contracting_authority_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  rank real,
  match_kind text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with
  bounds as (
    select
      greatest(1, least(coalesce(p_limit, 20), 100)) as lim,
      greatest(0, coalesce(p_offset, 0)) as off,
      300 as top_k
  ),
  q as (
    select
      nullif(
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
  qmeta as (
    select
      text_q,
      case
        when text_q is null then null
        else plainto_tsquery('spanish', public.f_unaccent(text_q))
      end as tsq,
      (
        text_q is not null
        and char_length(text_q) between 3 and 120
      ) as trgm_ok
    from q
  ),
  cpv_mode as (
    select case
      when lower(coalesce(nullif(trim(p_cpv_match), ''), 'any')) = 'all'
        then 'all'
      else 'any'
    end as mode
  ),
  -- Prefiltro CPV: ids candidatos antes de tocar FTS/trgm.
  cpv_ids as (
    select distinct tc.tender_id as id
    from public.tender_cpvs tc
    where p_cpv_codes is not null
      and (
        (
          (select mode from cpv_mode) = 'any'
          and exists (
            select 1
            from unnest(p_cpv_codes) as c(code)
            where tc.cpv_code like c.code || '%'
          )
        )
        or (
          (select mode from cpv_mode) = 'all'
          and (
            select bool_and(
              exists (
                select 1
                from public.tender_cpvs tc2
                where tc2.tender_id = tc.tender_id
                  and tc2.cpv_code like c.code || '%'
              )
            )
            from unnest(p_cpv_codes) as c(code)
          )
        )
      )
  ),
  need_authority as (
    select (
      p_authority_tax_ids is not null
      or p_authority_ids is not null
      or p_authority_name_contains is not null
      or p_municipalities is not null
      or p_countries is not null
    ) as yes
  ),
  -- NOT MATERIALIZED: el planner puede empujar FTS/trgm al índice GIN.
  filtered as not materialized (
    select
      t.id,
      t.title,
      t.search_vector,
      t.publication_date,
      t.created_at
    from public.tenders t
    left join public.contracting_authorities ca
      on (select yes from need_authority)
     and ca.id = t.contracting_authority_id
    where
      (p_cpv_codes is null or t.id in (select id from cpv_ids))
      and (
        not (select yes from need_authority)
        or (
          (p_authority_tax_ids is null or ca.tax_id = any (p_authority_tax_ids))
          and (p_authority_ids is null or ca.id = any (p_authority_ids))
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
          and (p_countries is null or ca.country = any (p_countries))
        )
      )
      and (p_ccaa_codes is null or t.place_ccaa_code = any (p_ccaa_codes))
      and (
        p_municipality_codes is null
        or t.place_municipality_code = any (p_municipality_codes)
      )
      and (
        p_estimated_value_min is null
        or t.estimated_value >= p_estimated_value_min
      )
      and (
        p_estimated_value_max is null
        or t.estimated_value <= p_estimated_value_max
      )
      and (p_contract_types is null or t.contract_type = any (p_contract_types))
      and (p_procedure_types is null or t.procedure_type = any (p_procedure_types))
      and (p_statuses is null or t.status = any (p_statuses))
      and (
        p_publication_date_from is null
        or t.publication_date >= p_publication_date_from
      )
      and (
        p_publication_date_to is null
        or t.publication_date <= p_publication_date_to
      )
      and (p_deadline_from is null or t.deadline_at >= p_deadline_from)
      and (p_deadline_to is null or t.deadline_at <= p_deadline_to)
      and (
        p_open_for_submission is distinct from true
        or (t.deadline_at is not null and t.deadline_at > now())
      )
  ),
  fts_cand as (
    select
      f.id,
      ts_rank(f.search_vector, (select tsq from qmeta)) as fts_rank,
      true as fts_hit,
      false as trgm_hit
    from filtered f
    where (select text_q from qmeta) is not null
      and (select tsq from qmeta) is not null
      and numnode((select tsq from qmeta)) > 0
      and f.search_vector @@ (select tsq from qmeta)
    order by
      fts_rank desc,
      f.publication_date desc nulls last,
      f.created_at desc
    limit (select top_k from bounds)
  ),
  trgm_cand as (
    select
      f.id,
      greatest(
        similarity(f.title, (select text_q from qmeta)),
        strict_word_similarity((select text_q from qmeta), f.title)
      ) as trgm_rank,
      false as fts_hit,
      true as trgm_hit
    from filtered f
    where (select trgm_ok from qmeta)
      and (
        (select text_q from qmeta) <<% f.title
        or f.title % (select text_q from qmeta)
      )
    order by
      trgm_rank desc,
      f.publication_date desc nulls last,
      f.created_at desc
    limit (select top_k from bounds)
  ),
  filter_cand as (
    select
      f.id,
      0::real as filter_rank,
      false as fts_hit,
      false as trgm_hit
    from filtered f
    where (select text_q from qmeta) is null
    order by
      f.publication_date desc nulls last,
      f.created_at desc
    limit (
      select top_k + lim + off from bounds
    )
  ),
  merged as (
    select
      c.id,
      max(c.fts_rank) as fts_rank,
      max(c.trgm_rank) as trgm_rank,
      bool_or(c.fts_hit) as fts_hit,
      bool_or(c.trgm_hit) as trgm_hit
    from (
      select id, fts_rank, 0::real as trgm_rank, fts_hit, trgm_hit from fts_cand
      union all
      select id, 0::real as fts_rank, trgm_rank, fts_hit, trgm_hit from trgm_cand
      union all
      select id, filter_rank, 0::real, fts_hit, trgm_hit from filter_cand
    ) c
    group by c.id
  ),
  scored as (
    select
      m.id,
      t.title,
      t.description,
      t.status,
      t.procedure_type,
      t.contract_type,
      t.estimated_value,
      t.currency,
      t.publication_date,
      t.deadline_at,
      t.contracting_authority_id,
      t.created_at,
      t.updated_at,
      case
        when (select text_q from qmeta) is null then 0::real
        else greatest(
          coalesce(m.fts_rank, 0::real),
          coalesce(m.trgm_rank, 0::real)
        )
      end as rank_score,
      m.fts_hit,
      m.trgm_hit,
      (
        (select text_q from qmeta) is not null
        and not exists (
          select 1
          from regexp_split_to_table(
            lower(public.f_unaccent((select text_q from qmeta))),
            '[^[:alnum:]]+'
          ) as qw(word)
          where qw.word <> ''
            and not exists (
              select 1
              from regexp_split_to_table(
                lower(public.f_unaccent(t.title)),
                '[^[:alnum:]]+'
              ) as tw(word)
              where tw.word = qw.word
            )
        )
      ) as literal_title_hit,
      case
        when p_cpv_codes is null then 0
        else (
          select count(*)::integer
          from unnest(p_cpv_codes) as c(code)
          where exists (
            select 1
            from public.tender_cpvs tc
            where tc.tender_id = m.id
              and tc.cpv_code like c.code || '%'
          )
        )
      end as cpv_hit_count
    from merged m
    join public.tenders t on t.id = m.id
  ),
  totals as (
    select case
      when p_known_total is not null then p_known_total
      when (select text_q from qmeta) is null then
        (select count(*)::bigint from filtered)
      else
        (select count(*)::bigint from scored)
    end as total_count
  )
  select
    s.id,
    s.title,
    s.description,
    s.status,
    s.procedure_type,
    s.contract_type,
    s.estimated_value,
    s.currency,
    (
      select coalesce(array_agg(tc.cpv_code order by tc.cpv_code), '{}'::text[])
      from public.tender_cpvs tc
      where tc.tender_id = s.id
    ) as cpv_codes,
    s.publication_date,
    s.deadline_at,
    s.contracting_authority_id,
    s.created_at,
    s.updated_at,
    s.rank_score as rank,
    case
      when (select text_q from qmeta) is null then 'filter'
      when s.fts_hit and s.literal_title_hit then 'fts'
      when s.fts_hit or s.trgm_hit then 'trgm'
      else 'filter'
    end as match_kind,
    (select total_count from totals) as total_count
  from scored s
  order by
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'title'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.title
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'title'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.title
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'status'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.status
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'status'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.status
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'procedure_type'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.procedure_type
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'procedure_type'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.procedure_type
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'contract_type'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.contract_type
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'contract_type'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.contract_type
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'estimated_value'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.estimated_value
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'estimated_value'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.estimated_value
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'publication_date'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.publication_date
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'publication_date'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.publication_date
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'deadline_at'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.deadline_at
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'deadline_at'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.deadline_at
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'created_at'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.created_at
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'created_at'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.created_at
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'updated_at'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.updated_at
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) = 'updated_at'
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.updated_at
    end desc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) in ('relevance', '')
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'asc'
      then s.rank_score
    end asc nulls last,
    case
      when lower(coalesce(nullif(trim(p_sort_by), ''), 'relevance')) in ('relevance', '')
        and lower(coalesce(nullif(trim(p_sort_dir), ''), 'desc')) = 'desc'
      then s.rank_score
    end desc nulls last,
    s.rank_score desc,
    s.publication_date desc nulls last,
    s.cpv_hit_count desc,
    s.created_at desc
  limit (select lim from bounds)
  offset (select off from bounds);
$$;

comment on function public.search_tenders(
  text, text[], text[], text, text[], uuid[], text, text[], text[], text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, boolean, integer, integer, bigint, text, text
) is
  'FTS+trgm top-K + Criteria; FTS sin tildes (f_unaccent); total_count/p_known_total; sort; CPV any|all; open_for_submission.';

revoke all on function public.search_tenders(
  text, text[], text[], text, text[], uuid[], text, text[], text[], text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, boolean, integer, integer, bigint, text, text
) from public;
grant execute on function public.search_tenders(
  text, text[], text[], text, text[], uuid[], text, text[], text[], text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, boolean, integer, integer, bigint, text, text
) to anon, authenticated;
