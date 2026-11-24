-- Bitácora: tipo de evento para el alta del expediente en Mis licitaciones.
alter table public.offer_case_log
  drop constraint if exists offer_case_log_event_type_check;

alter table public.offer_case_log
  add constraint offer_case_log_event_type_check
  check (
    event_type in (
      'alta_expediente',
      'stage_change',
      'go_decision',
      'aclaracion',
      'rectificacion',
      'ampliacion_plazo',
      'requerimiento',
      'subsanacion',
      'requirement_change',
      'comentario',
      'otro'
    )
  );

comment on column public.offer_case_log.event_type is
  'Tipo tipado de entrada; alta_expediente = añadida a Mis licitaciones.';
