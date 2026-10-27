-- Limpieza: si quedó la firma Semana 5 (sin p_title_query) junto a la de Semana 6,
-- COMMENT/GRANT sin firma fallan con "function name is not unique".
-- Idempotente: en remoto el DROP ya está al inicio de 20261013100000.

drop function if exists public.search_tenders(
  text, text[], text[], text[], uuid[], text, text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, integer, integer
);
