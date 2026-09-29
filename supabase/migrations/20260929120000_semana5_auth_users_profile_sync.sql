-- Semana 5 / Paso 5: sync auth.users → public.users (perfil de aplicación).
-- SECURITY DEFINER: el trigger escribe el perfil aunque el signup aún no tenga grants amplios.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(both from new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'user'
    )
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Semana 5: crea fila en public.users al registrarse en Auth. Idempotente.';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill perfiles para usuarios Auth ya existentes (p. ej. seed Alice/Bob tras migración).
insert into public.users (auth_user_id, display_name)
select
  u.id,
  coalesce(
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'user'
  )
from auth.users u
where not exists (
  select 1 from public.users p where p.auth_user_id = u.id
);
