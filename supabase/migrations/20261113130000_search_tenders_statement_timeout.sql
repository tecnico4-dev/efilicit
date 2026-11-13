-- search_tenders: un poco más de margen ante consultas amplias (default API ~8s).
-- El timeout de rol/API sigue aplicando a otras sentencias; solo esta RPC.

alter function public.search_tenders(
  text, text[], text[], text, text[], uuid[], text, text[], text[], text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, boolean, integer, integer, bigint, text, text
) set statement_timeout = '20s';

comment on function public.search_tenders(
  text, text[], text[], text, text[], uuid[], text, text[], text[], text[], text[],
  numeric, numeric, text[], text[], text[], date, date,
  timestamptz, timestamptz, boolean, integer, integer, bigint, text, text
) is
  'FTS+trgm top-K + Criteria; FTS sin tildes (f_unaccent); total_count/p_known_total; sort; CPV any|all; open_for_submission; statement_timeout 20s.';
