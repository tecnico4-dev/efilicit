-- ADR 015: tenders es copia de una sola fuente dueña (canonical_source_code).
-- Backfill: source_code del tender_sources más antiguo; huérfanos → 'unknown'.

alter table public.tenders
  add column if not exists canonical_source_code text;

update public.tenders t
set canonical_source_code = sub.source_code
from (
  select distinct on (ts.tender_id)
    ts.tender_id,
    ts.source_code
  from public.tender_sources ts
  order by ts.tender_id, ts.created_at asc, ts.id asc
) as sub
where t.id = sub.tender_id
  and t.canonical_source_code is null;

update public.tenders
set canonical_source_code = 'unknown'
where canonical_source_code is null;

alter table public.tenders
  alter column canonical_source_code set not null;

comment on column public.tenders.canonical_source_code is
  'Fuente dueña de la copia canónica (ADR 015). Otras fuentes solo enlazan en tender_sources.';

create index if not exists tenders_canonical_source_code_idx
  on public.tenders (canonical_source_code);
