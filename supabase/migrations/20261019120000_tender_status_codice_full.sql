-- CODICE SyndicationContractFolderStatusCode 2.04 → vocabulario ES.
-- ANUL (oficial) + ANU (alias conectores); DES = extensión producto «desierta».

update public.tenders
set status = case upper(status)
  when 'PUB' then 'publicada'
  when 'PRE' then 'preparada'
  when 'EV' then 'evaluacion'
  when 'ADJ' then 'adjudicada'
  when 'RES' then 'resuelta'
  when 'ANUL' then 'anulada'
  when 'ANU' then 'anulada'
  when 'DES' then 'desierta'
  else status
end
where upper(status) in ('PUB', 'PRE', 'EV', 'ADJ', 'RES', 'ANUL', 'ANU', 'DES');

-- Códigos CODICE/huérfanos en MAYÚSCULAS cortas que no sean slug ES → null.
update public.tenders
set status = null
where status ~ '^[A-Z]{2,5}$';

update public.tender_events
set event_status = case upper(event_status)
  when 'PUB' then 'publicada'
  when 'PRE' then 'preparada'
  when 'EV' then 'evaluacion'
  when 'ADJ' then 'adjudicada'
  when 'RES' then 'resuelta'
  when 'ANUL' then 'anulada'
  when 'ANU' then 'anulada'
  when 'DES' then 'desierta'
  else event_status
end
where event_status is not null
  and upper(event_status) in ('PUB', 'PRE', 'EV', 'ADJ', 'RES', 'ANUL', 'ANU', 'DES');

update public.tender_events
set event_status = null
where event_status ~ '^[A-Z]{2,5}$';

comment on column public.tenders.status is
  'Estado de negocio (vocabulario ES, CODICE ContractFolderStatus): publicada, preparada, '
  'evaluacion, adjudicada, resuelta, anulada; extensión producto: desierta.';

comment on column public.tender_events.event_status is
  'Estado de negocio (mismo vocabulario ES que tenders.status) en el momento del evento.';
