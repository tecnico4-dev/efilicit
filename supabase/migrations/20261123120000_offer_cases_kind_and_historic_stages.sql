-- Mis licitaciones: kind propia|subcontrata (obligatorio) y stages históricos
-- solo adjudicada | no_adjudicada | descartada.
-- Enmienda ADR 023/026 → ADR 036.

-- 1) Columna kind (nullable mientras backfill)
alter table public.offer_cases
  add column if not exists kind text;

comment on column public.offer_cases.kind is
  'propia = Eficen se presenta; subcontrata = interés vía subcontrata. Obligatorio.';

-- 2) Backfill: todo propia salvo los que estaban en stage subcontrata
update public.offer_cases
set kind = 'propia'
where kind is null;

update public.offer_cases
set
  kind = 'subcontrata',
  stage = 'adjudicada',
  outcome_on = coalesce(outcome_on, presented_on, current_date)
where stage = 'subcontrata';

-- Desierta deja de ser stage de expediente → descartada
update public.offer_cases
set
  stage = 'descartada',
  discard_reason = coalesce(
    nullif(trim(discard_reason), ''),
    'Migrado desde stage desierta (ya no usado en Mis licitaciones).'
  ),
  outcome_on = coalesce(outcome_on, presented_on, current_date)
where stage = 'desierta';

-- 3) kind NOT NULL + CHECK + default
alter table public.offer_cases
  alter column kind set default 'propia';

alter table public.offer_cases
  alter column kind set not null;

alter table public.offer_cases
  drop constraint if exists offer_cases_kind_check;

alter table public.offer_cases
  add constraint offer_cases_kind_check
  check (kind in ('propia', 'subcontrata'));

create index if not exists offer_cases_kind_idx
  on public.offer_cases (kind);

-- 4) Stages: quitar subcontrata y desierta del CHECK
alter table public.offer_cases
  drop constraint if exists offer_cases_stage_check;

alter table public.offer_cases
  add constraint offer_cases_stage_check
  check (
    stage = any (
      array[
        'interes',
        'analisis',
        'preparacion',
        'presentada',
        'en_evaluacion',
        'requerimiento',
        'adjudicada',
        'no_adjudicada',
        'descartada'
      ]::text[]
    )
  );

comment on column public.offer_cases.stage is
  'Activas: interes|analisis|preparacion|presentada|en_evaluacion|requerimiento. Histórico: adjudicada|no_adjudicada|descartada.';
