-- CODICE ProcedureCode 9 = Abierto simplificado.
-- Filas ya normalizadas con el literal "9" pasan al vocabulario ES canónico.

update public.tenders
set procedure_type = 'abierto_simplificado'
where procedure_type = '9';

comment on column public.tenders.procedure_type is
  'Procedimiento de adjudicación (vocabulario ES): abierto, abierto_simplificado, '
  'restringido, negociado, dialogo_competitivo, asociacion_innovacion, otro.';
