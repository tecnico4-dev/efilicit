-- Retira el puente N:M requisito↔entregable: el producto usa
-- offer_requirements.envelope (A/B/C) y no necesita esta tabla.

drop table if exists public.offer_requirement_deliverables;
