-- Bloque A (endurecimiento offer): garantizar is_app_user() aunque
-- 20261030130100 la hubiera dropeado y el entorno ya tuviera offer_* aplicadas.
-- Idempotente. Solo local / futuros resets hasta OK explícito de remoto.

create or replace function public.is_app_user()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = (select auth.uid())
  );
$$;

comment on function public.is_app_user() is
  'True si auth.uid() tiene fila en public.users (invite-only). RLS offer_*/company_* (y legacy bid_* si existiera).';

revoke all on function public.is_app_user() from public;
grant execute on function public.is_app_user() to authenticated;
