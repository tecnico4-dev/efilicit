-- Higiene defensiva tras auditoría remota (vocabulario ES / CPV / NUTS).
-- Idempotente: en el momento de la auditoría no había literales CODICE huérfanos;
-- estas reglas evitan basura residual y unifican aliases legacy.

-- Alias legacy de procedimiento (mapa MVP) → slug CODICE preciso.
update public.tenders
set procedure_type = 'negociado_sin_publicidad'
where procedure_type = 'negociado';

-- Códigos CODICE / EN cortos en MAYÚSCULAS o dígitos sueltos → null / otro.
update public.tenders
set status = null
where status ~ '^[A-Z]{2,5}$';

update public.tenders
set contract_type = 'otro'
where contract_type ~ '^[0-9]+$';

update public.tenders
set procedure_type = 'otro'
where procedure_type ~ '^[0-9]+$';

update public.tender_events
set event_status = null
where event_status ~ '^[A-Z]{2,5}$';

-- CPV: quitar no-dígitos; si no queda 2–8 dígitos → null.
update public.tenders
set cpv_code = nullif(regexp_replace(cpv_code, '\D', '', 'g'), '')
where cpv_code is not null
  and cpv_code !~ '^[0-9]{2,8}$';

update public.tenders
set cpv_code = null
where cpv_code is not null
  and (length(cpv_code) < 2 or length(cpv_code) > 8 or cpv_code !~ '^[0-9]+$');

-- NUTS de lugar: solo patrón ES…; basura → null (no inventar CCAA).
update public.tenders
set place_nuts_code = null
where place_nuts_code is not null
  and place_nuts_code !~ '^ES[0-9A-Z]{1,3}$';
