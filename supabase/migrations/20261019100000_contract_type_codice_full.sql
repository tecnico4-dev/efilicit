-- CODICE ContractCode 2.08 → vocabulario ES canónico completo.
-- Remapea literales numéricos ya persistidos y corrige 8 (antes «otro» → «privado»).

update public.tenders
set contract_type = case contract_type
  when '1' then 'suministros'
  when '2' then 'servicios'
  when '3' then 'obras'
  when '7' then 'administrativo_especial'
  when '8' then 'privado'
  when '21' then 'gestion_servicios_publicos'
  when '22' then 'concesion_servicios'
  when '31' then 'concesion_obras_publicas'
  when '32' then 'concesion_obras'
  when '40' then 'colaboracion_publico_privada'
  when '50' then 'patrimonial'
  else contract_type
end
where contract_type in (
  '1', '2', '3', '7', '8', '21', '22', '31', '32', '40', '50'
);

-- Cualquier otro literal numérico huérfano → «otro» (no mostrar código crudo).
update public.tenders
set contract_type = 'otro'
where contract_type ~ '^[0-9]+$';

comment on column public.tenders.contract_type is
  'Tipo de contrato (vocabulario ES, CODICE ContractCode): suministros, servicios, '
  'obras, administrativo_especial, privado, gestion_servicios_publicos, '
  'concesion_servicios, concesion_obras_publicas, concesion_obras, '
  'colaboracion_publico_privada, patrimonial, otro.';
