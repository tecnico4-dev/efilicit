-- Semana 5 / Paso 1: documentar el contrato jsonb de criteria (sin DDL de columnas).
-- Shape canónico: packages/types/src/criteria.ts y efilicit_ingestion.alerts.criteria

comment on table public.saved_searches is
  'Búsquedas guardadas. criteria jsonb = SearchCriteria v1 '
  '(keywords, cpv_codes, authority, geography, importes, tipos, fechas). '
  'Ver packages/types/src/criteria.ts';

comment on column public.saved_searches.criteria is
  'SearchCriteria v1 (jsonb). Campos omitidos no filtran; AND entre dimensiones; OR dentro de arrays.';

comment on table public.alerts is
  'Reglas de alerta. criteria jsonb = AlertCriteria v1 (mismo shape que saved_searches). '
  'Motor batch Semana 5. Ver packages/types/src/criteria.ts';

comment on column public.alerts.criteria is
  'AlertCriteria v1 (jsonb). criteria vacío / solo version no debe generar matches (anti-spam).';
