-- Clasificación de alerta: propia (Eficen) vs subcontrata (mismo vocabulario que favoritos).

alter table public.alerts
  add column if not exists kind text;

update public.alerts
set kind = 'propia'
where kind is null;

alter table public.alerts
  alter column kind set not null;

alter table public.alerts
  drop constraint if exists alerts_kind_check;

alter table public.alerts
  add constraint alerts_kind_check
  check (kind in ('propia', 'subcontrata'));

comment on column public.alerts.kind is
  'Clasificación de la alerta: propia = Eficen; subcontrata = Subcontrata.';
