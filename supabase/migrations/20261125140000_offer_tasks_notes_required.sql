-- offer_tasks: título opcional; notes (descripción UI) obligatorio.
-- Solo local/Studio. Enmienda ADR 026.

alter table public.offer_tasks
  drop constraint if exists offer_tasks_title_nonempty;

-- Filas legacy sin notes: rellenar desde title si hace falta.
update public.offer_tasks
set notes = coalesce(nullif(trim(notes), ''), nullif(trim(title), ''), 'Sin descripción')
where notes is null or trim(notes) = '';

alter table public.offer_tasks
  alter column title drop not null;

alter table public.offer_tasks
  alter column notes set not null;

alter table public.offer_tasks
  drop constraint if exists offer_tasks_notes_nonempty;

alter table public.offer_tasks
  add constraint offer_tasks_notes_nonempty
  check (char_length(trim(notes)) > 0);

comment on column public.offer_tasks.title is
  'Título opcional de la tarea (cabecera corta).';

comment on column public.offer_tasks.notes is
  'Descripción obligatoria de la tarea (texto principal).';
