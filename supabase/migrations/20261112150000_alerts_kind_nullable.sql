-- Clasificación opcional en legado: NULL = sin clasificar (hay que elegir al editar).
-- Quita el NOT NULL del backfill 20261112130000.
-- Anula solo 'propia' del backfill (no era elección); conserva 'subcontrata' ya marcada.

alter table public.alerts
  alter column kind drop not null;

update public.alerts
set kind = null
where kind = 'propia';

comment on column public.alerts.kind is
  'Clasificación: propia = Eficen; subcontrata = Subcontrata. NULL = pendiente (alertas antiguas).';
