-- Mis licitaciones: etapa histórica «subcontrata» (participación sin ser adjudicatario).

alter table public.bid_cases
  drop constraint if exists bid_cases_stage_check;

alter table public.bid_cases
  add constraint bid_cases_stage_check
  check (
    stage in (
      'interes',
      'preparacion',
      'presentada',
      'adjudicada',
      'no_adjudicada',
      'descartada',
      'subcontrata'
    )
  );

comment on column public.bid_cases.stage is
  'interes|preparacion|presentada (activas) · adjudicada|no_adjudicada|descartada|subcontrata (histórico).';
