-- Criterios de adjudicación viven en offer_deliverables (Sobres / Resumen),
-- no en la matriz offer_requirements. Estimación propia → our_estimate.

alter table public.offer_deliverables
  add column if not exists our_estimate text;

comment on column public.offer_deliverables.our_estimate is
  'Estimación propia de puntuación (criterios B/C); editable en Resumen.';

-- Copiar estimaciones ya guardadas en requisitos criterio_* → entregable hijo.
update public.offer_deliverables d
set our_estimate = nullif(trim(r.our_value), '')
from public.offer_requirements r
where r.offer_case_id = d.offer_case_id
  and r.category = 'criterio_adjudicacion'
  and r.source_key is not null
  and r.envelope in ('B', 'C')
  and d.source_key = 'env:' || r.envelope || ':' || r.source_key
  and nullif(trim(r.our_value), '') is not null
  and d.our_estimate is null;

-- Quitar filas de matriz que eran criterios (los sobres ya tienen los hijos).
delete from public.offer_requirements
where category = 'criterio_adjudicacion';
