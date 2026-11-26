-- offer_tasks: asignado = eficen_members (alineado con offer_cases / requisitos).
-- Quita owner_user_id / owner_name. Añade created_by (quién dio de alta).
-- Solo local/Studio hasta OK remoto. Enmienda ADR 026.

alter table public.offer_tasks
  add column if not exists owner_member_id uuid null
    references public.eficen_members (id) on delete set null;

comment on column public.offer_tasks.owner_member_id is
  'Asignado de la tarea (eficen_members). Null = sin asignar.';

alter table public.offer_tasks
  add column if not exists created_by uuid null
    references public.users (id) on delete set null;

comment on column public.offer_tasks.created_by is
  'Usuario de aplicación que creó la tarea (users). Distinto del asignado.';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offer_tasks'
      and column_name = 'owner_user_id'
  ) then
    update public.offer_tasks t
    set owner_member_id = em.id
    from public.eficen_members em
    where t.owner_member_id is null
      and t.owner_user_id is not null
      and em.user_id = t.owner_user_id;
  end if;
end $$;

alter table public.offer_tasks
  drop constraint if exists offer_tasks_title_nonempty;

alter table public.offer_tasks
  add constraint offer_tasks_title_nonempty
  check (char_length(trim(title)) > 0);

drop index if exists public.offer_tasks_owner_user_idx;

alter table public.offer_tasks
  drop constraint if exists offer_tasks_owner_user_id_fkey;

alter table public.offer_tasks
  drop column if exists owner_user_id,
  drop column if exists owner_name;

create index if not exists offer_tasks_owner_member_idx
  on public.offer_tasks (owner_member_id)
  where owner_member_id is not null;

create index if not exists offer_tasks_open_case_idx
  on public.offer_tasks (offer_case_id, due_at)
  where done_at is null;

comment on table public.offer_tasks is
  'Tareas sueltas del expediente (no son requisito ni entregable). Asignado = eficen_members.';
