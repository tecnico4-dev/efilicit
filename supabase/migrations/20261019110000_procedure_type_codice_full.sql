-- CODICE SyndicationTenderingProcessCode 2.07 → vocabulario ES canónico completo.
-- Corrige el mapa MVP antiguo (4/5/6 desplazados) y remapea literales numéricos.
-- Orden: primero slugs del mapa viejo; después códigos numéricos (así 5/10 no se pisan).

-- 1) Slugs del mapa MVP incorrecto (CODICE 4→dialogo, 5→asociacion, 3→negociado).
update public.tenders
set procedure_type = 'negociado_con_publicidad'
where procedure_type = 'dialogo_competitivo';

update public.tenders
set procedure_type = 'dialogo_competitivo'
where procedure_type = 'asociacion_innovacion';

update public.tenders
set procedure_type = 'negociado_sin_publicidad'
where procedure_type = 'negociado';

-- 2) Literales numéricos (idempotente respecto a migraciones parciales previas).
update public.tenders
set procedure_type = case procedure_type
  when '1' then 'abierto'
  when '2' then 'restringido'
  when '3' then 'negociado_sin_publicidad'
  when '4' then 'negociado_con_publicidad'
  when '5' then 'dialogo_competitivo'
  when '6' then 'contrato_menor'
  when '7' then 'derivado_acuerdo_marco'
  when '8' then 'concurso_proyectos'
  when '9' then 'abierto_simplificado'
  when '10' then 'asociacion_innovacion'
  when '11' then 'derivado_asociacion_innovacion'
  when '12' then 'sistema_dinamico_adquisicion'
  when '13' then 'licitacion_con_negociacion'
  when '100' then 'normas_internas'
  when '999' then 'otro'
  else procedure_type
end
where procedure_type in (
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
  '100', '999'
);

-- 3) Cualquier otro literal numérico huérfano → «otro».
update public.tenders
set procedure_type = 'otro'
where procedure_type ~ '^[0-9]+$';

comment on column public.tenders.procedure_type is
  'Procedimiento (vocabulario ES, CODICE SyndicationTenderingProcessCode): abierto, '
  'restringido, negociado_sin_publicidad, negociado_con_publicidad, dialogo_competitivo, '
  'contrato_menor, derivado_acuerdo_marco, concurso_proyectos, abierto_simplificado, '
  'asociacion_innovacion, derivado_asociacion_innovacion, sistema_dinamico_adquisicion, '
  'licitacion_con_negociacion, normas_internas, otro.';
