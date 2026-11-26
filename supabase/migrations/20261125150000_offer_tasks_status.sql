-- offer_tasks: status pendiente|hecha|descartada (sustituye done_at).
-- Solo local/Studio. Enmienda ADR 026.

alter table public.offer_tasks
  add column if not exists status text;

update public.offer_tasks
set status = case
  when done_at is not null then 'hecha'
  else 'pendiente'
end
where status is null;

alter table public.offer_tasks
  alter column status set default 'pendiente';

alter table public.offer_tasks
  alter column status set not null;

alter table public.offer_tasks
  drop constraint if exists offer_tasks_status_check;

alter table public.offer_tasks
  add constraint offer_tasks_status_check
  check (status in ('pendiente', 'hecha', 'descartada'));

comment on column public.offer_tasks.status is
  'Estado de la tarea: pendiente (alta), hecha o descartada.';

drop index if exists public.offer_tasks_open_case_idx;

alter table public.offer_tasks
  drop column if exists done_at;

create index if not exists offer_tasks_case_status_idx
  on public.offer_tasks (offer_case_id, status, due_at);

create index if not exists offer_tasks_pendiente_case_idx
  on public.offer_tasks (offer_case_id, due_at)
  where status = 'pendiente';
