-- Mis licitaciones: etapa histórica «subcontrata» (participación sin ser adjudicatario).
-- Guarda: tras 20261030130100 (rollback remoto) bid_cases puede no existir (db reset limpio).

do $$
begin
  if to_regclass('public.bid_cases') is null then
    raise notice 'bid_cases ausente — omito ALTER stage subcontrata (legacy ya dropeado)';
    return;
  end if;

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
end;
$$;
