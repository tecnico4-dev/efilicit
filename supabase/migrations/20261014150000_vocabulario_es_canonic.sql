-- Vocabulario canónico de producto en español (rama Arreglos-DB).
-- No toca source_code / review_status / identity_confidence / colas ETL.
-- criteria jsonb: sin remap (UI MVP no guarda esos enums aún).

-- ---------------------------------------------------------------------------
-- users.digest_frequency: daily|weekly → diaria|semanal
-- ---------------------------------------------------------------------------
alter table public.users
  drop constraint if exists users_digest_frequency_check;

update public.users
set digest_frequency = case digest_frequency
  when 'daily' then 'diaria'
  when 'weekly' then 'semanal'
  else digest_frequency
end;

alter table public.users
  alter column digest_frequency set default 'diaria';

alter table public.users
  add constraint users_digest_frequency_check
  check (digest_frequency in ('diaria', 'semanal'));

comment on column public.users.digest_frequency is
  'Frecuencia del email de alertas de la cuenta (diaria|semanal). '
  'Aplica a todas las alertas del usuario; un correo por periodo. '
  'instant no forma parte del MVP.';

-- ---------------------------------------------------------------------------
-- alerts.frequency (alineado; instant → instantanea si existía)
-- ---------------------------------------------------------------------------
alter table public.alerts
  drop constraint if exists alerts_frequency_check;

update public.alerts
set frequency = case frequency
  when 'daily' then 'diaria'
  when 'weekly' then 'semanal'
  when 'instant' then 'instantanea'
  else frequency
end;

alter table public.alerts
  alter column frequency set default 'diaria';

alter table public.alerts
  add constraint alerts_frequency_check
  check (frequency in ('diaria', 'semanal', 'instantanea'));

-- ---------------------------------------------------------------------------
-- tenders.status / procedure_type / contract_type
-- ---------------------------------------------------------------------------
update public.tenders
set status = case status
  when 'published' then 'publicada'
  when 'prepared' then 'preparada'
  when 'awarded' then 'adjudicada'
  when 'resolved' then 'resuelta'
  when 'cancelled' then 'anulada'
  when 'deserted' then 'desierta'
  when 'evaluation' then 'evaluacion'
  else status
end
where status is not null;

update public.tenders
set procedure_type = case procedure_type
  when 'open' then 'abierto'
  when 'restricted' then 'restringido'
  when 'negotiated' then 'negociado'
  when 'competitive_dialogue' then 'dialogo_competitivo'
  when 'innovation_partnership' then 'asociacion_innovacion'
  when 'other' then 'otro'
  else procedure_type
end
where procedure_type is not null;

update public.tenders
set contract_type = case contract_type
  when 'supplies' then 'suministros'
  when 'services' then 'servicios'
  when 'works' then 'obras'
  when 'other' then 'otro'
  else contract_type
end
where contract_type is not null;

comment on column public.tenders.status is
  'Estado de negocio (vocabulario ES): publicada, preparada, adjudicada, resuelta, anulada, desierta, evaluacion.';

comment on column public.tenders.procedure_type is
  'Procedimiento de adjudicación (vocabulario ES): abierto, restringido, negociado, dialogo_competitivo, asociacion_innovacion, otro.';

comment on column public.tenders.contract_type is
  'Tipo de contrato (vocabulario ES): suministros, servicios, obras, otro.';

-- ---------------------------------------------------------------------------
-- tender_events.event_status (mismo vocabulario que tenders.status)
-- ---------------------------------------------------------------------------
update public.tender_events
set event_status = case event_status
  when 'published' then 'publicada'
  when 'prepared' then 'preparada'
  when 'awarded' then 'adjudicada'
  when 'resolved' then 'resuelta'
  when 'cancelled' then 'anulada'
  when 'deserted' then 'desierta'
  when 'evaluation' then 'evaluacion'
  else event_status
end
where event_status is not null;

comment on column public.tender_events.event_status is
  'Estado de negocio (vocabulario ES de tenders.status) en el momento del evento.';

-- ---------------------------------------------------------------------------
-- documents.document_type
-- ---------------------------------------------------------------------------
update public.documents
set document_type = case document_type
  when 'publication' then 'publicacion'
  else document_type
end
where document_type is not null;

comment on column public.documents.document_type is
  'Tipo de documento (vocabulario ES); p. ej. publicacion.';
