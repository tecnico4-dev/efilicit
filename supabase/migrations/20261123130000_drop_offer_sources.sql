-- Retira registro de fuentes del expediente y su puente N:M.
-- La trazabilidad del intake vive en offer_requirements / offer_case_pliegos
-- (source_kind, source_key, pliego_id); no hace falta offer_sources.

drop table if exists public.offer_source_links;
drop table if exists public.offer_sources;
