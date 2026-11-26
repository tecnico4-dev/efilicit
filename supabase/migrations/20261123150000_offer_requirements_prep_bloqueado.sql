-- Añade prep_status = bloqueado en requisitos del expediente.

alter table public.offer_requirements
  drop constraint if exists offer_requirements_prep_status_check;

alter table public.offer_requirements
  add constraint offer_requirements_prep_status_check
  check (
    prep_status in (
      'pendiente',
      'en_curso',
      'en_revision',
      'listo',
      'bloqueado'
    )
  );
