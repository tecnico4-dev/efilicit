-- Directorio Eficen: ficha visible al tenant; enlace opcional 1:1 a users.
-- Alta/edición: admin BD / service_role (sin policies write authenticated).
-- ADR 032.

create table public.eficen_members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role_title text null,
  user_id uuid null unique references public.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eficen_members_display_name_nonempty
    check (char_length(btrim(display_name)) > 0)
);

comment on table public.eficen_members is
  'Directorio Eficen (picker share + Mis licitaciones). Visible al tenant; no sustituye users.';

comment on column public.eficen_members.user_id is
  'Cuenta app enlazada (nullable). Unique: a lo sumo un miembro por usuario.';

comment on column public.eficen_members.active is
  'False = oculto en pickers; la ficha sigue existiendo para historial.';

create index eficen_members_active_idx
  on public.eficen_members (active)
  where active = true;

create index eficen_members_user_id_idx
  on public.eficen_members (user_id)
  where user_id is not null;

create or replace function public.eficen_members_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists eficen_members_set_updated_at on public.eficen_members;
create trigger eficen_members_set_updated_at
  before update on public.eficen_members
  for each row
  execute function public.eficen_members_set_updated_at();

alter table public.eficen_members enable row level security;

create policy "eficen_members_select_app_user"
  on public.eficen_members for select to authenticated
  using (public.is_app_user());

revoke all on table public.eficen_members from public;
revoke all on table public.eficen_members from anon;
grant select on table public.eficen_members to authenticated;
