-- Bitácora: tipo de sistema para el intake / extracción del anuncio PLACSP (ADR 035).
alter table public.offer_case_log
  drop constraint if exists offer_case_log_event_type_check;

alter table public.offer_case_log
  add constraint offer_case_log_event_type_check
  check (
    event_type in (
      'alta_expediente',
      'stage_change',
      'go_decision',
      'extraccion_anuncio',
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
  'Tipo tipado; extraccion_anuncio = carga/reproceso automático desde el anuncio PLACSP.';

-- Entradas antiguas del worker (event_type = otro + copy técnico).
update public.offer_case_log
set event_type = 'extraccion_anuncio'
where event_type = 'otro'
  and body like 'Intake PLACSP:%';
