-- Quita stage en_evaluacion: post-envío = presentada (presented_on).
update public.offer_cases
set stage = 'presentada'
where stage = 'en_evaluacion';

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
        'requerimiento',
        'adjudicada',
        'no_adjudicada',
        'descartada'
      ]::text[]
    )
  );

comment on column public.offer_cases.stage is
  'Activas: interes|analisis|preparacion|presentada|requerimiento. Histórico: adjudicada|no_adjudicada|descartada.';
