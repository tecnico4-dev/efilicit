-- Dimensión de interés al puntuar: propia (Eficen) vs subcontrata.
-- NULL = sin clasificar (preferible a asumir «propia»).

alter table public.tender_ratings
  add column if not exists interest_kind text
    check (
      interest_kind is null
      or interest_kind in ('propia', 'subcontrata')
    );

comment on column public.tender_ratings.interest_kind is
  'Interés al puntuar: propia (Eficen adjudicataria), subcontrata, o null sin clasificar.';
