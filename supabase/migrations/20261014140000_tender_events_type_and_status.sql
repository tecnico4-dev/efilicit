-- tender_events: event_type = pipeline fact; event_status = business status snapshot

alter table public.tender_events
  add column if not exists event_status text;

comment on table public.tender_events is
  'Línea temporal: hechos de ingesta (ingerida/actualizada) y estado de negocio asociado.';

comment on column public.tender_events.event_type is
  'Hecho de pipeline: ingerida (primer enlace de fuente) o actualizada (cambio canónico real).';

comment on column public.tender_events.event_status is
  'Estado de negocio (vocabulario EN de tenders.status) en el momento del evento.';

-- Legacy rows stored business status (or ingested/updated) in event_type.
update public.tender_events
set event_status = event_type
where event_type in (
  'published',
  'prepared',
  'awarded',
  'resolved',
  'cancelled',
  'deserted',
  'evaluation'
);

update public.tender_events
set event_type = case
  when event_type = 'updated' then 'actualizada'
  else 'ingerida'
end;

alter table public.tender_events
  drop constraint if exists tender_events_event_type_check;

alter table public.tender_events
  add constraint tender_events_event_type_check
  check (event_type in ('ingerida', 'actualizada'));
