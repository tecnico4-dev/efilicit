-- search_tenders: top-K (FTS ∪ trgm) + guardrails trgm + índices filtro ligeros.
-- Evita rankear/ordenar toda la tabla antes del LIMIT (latencia ~O(K)).
--
-- Semántica (ver también CHANGELOG + apps/web/src/lib/queries/README.md; ADR 011 = contrato RPC):
-- 1) Filtros Criteria = sí/no (CCAA, CPV, estado, fechas, open_for_submission, …).
-- 2) Con texto: rama FTS (@@ + ts_rank) LIMIT K y rama trgm (<<% / %) LIMIT K; K=300.
-- 3) Trgm solo si length(query) entre 3 y 120 (evita stopwords cortas tipo «de»).
-- 4) Merge por id (mejor rank); orden final rank → publication_date → created_at
--    (desempate CPV: migración 20261022140000). UI suele pedir LIMIT 20.
-- Stopwords/AND se aplican en cliente/alertas antes de llegar aquí.

create index if not exists tenders_procedure_type_idx
  on public.tenders (procedure_type)
  where procedure_type is not null;

create index if not exists tenders_contract_type_idx
  on public.tenders (contract_type)
  where contract_type is not null;

create index if not exists tenders_deadline_at_not_null_idx
  on public.tenders (deadline_at)
  where deadline_at is not null;

drop function if exists public.search_tenders(
  text, text[], text[], text, text[], uuid[], text, text[], text[], text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, boolean, integer, integer
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
  cpv_codes text[],
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
        else plainto_tsquery('spanish', text_q)
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
            lower((select text_q from qmeta)),
            '[^[:alnum:]]+'
          ) as qw(word)
          where qw.word <> ''
            and not exists (
              select 1
              from regexp_split_to_table(lower(t.title), '[^[:alnum:]]+') as tw(word)
              where tw.word = qw.word
            )
        )
      ) as literal_title_hit
    from merged m
    join public.tenders t on t.id = m.id
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
    end as match_kind
  from scored s
  order by
    s.rank_score desc,
    s.publication_date desc nulls last,
    s.created_at desc
  limit (select lim from bounds)
  offset (select off from bounds);
$$;

comment on function public.search_tenders is
  'FTS+trgm top-K + Criteria; trgm solo si query 3–120 chars; CPV any|all; open_for_submission.';

revoke all on function public.search_tenders from public;
grant execute on function public.search_tenders to anon, authenticated;
