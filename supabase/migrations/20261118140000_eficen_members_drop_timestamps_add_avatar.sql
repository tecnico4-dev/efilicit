-- eficen_members: quitar timestamps (sin uso de producto) + avatar opcional
-- (iniciales en UI si null). Enmienda ADR 032.

drop trigger if exists eficen_members_set_updated_at on public.eficen_members;
drop function if exists public.eficen_members_set_updated_at();

alter table public.eficen_members
  drop column if exists created_at,
  drop column if exists updated_at;

alter table public.eficen_members
  add column if not exists avatar_url text null;

comment on column public.eficen_members.avatar_url is
  'URL o path de icono/foto; null = UI usa iniciales por defecto.';
