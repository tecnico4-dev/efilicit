-- Seguridad: handle_new_user es solo trigger (auth.users → public.users).
-- SECURITY DEFINER a propósito; no debe ser RPC pública (/rest/v1/rpc/...).
-- El trigger sigue ejecutándose; anon/authenticated dejan de poder llamarla.

revoke all on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;

comment on function public.handle_new_user() is
  'Semana 5: crea fila en public.users al registrarse en Auth. Solo trigger; sin EXECUTE para anon/authenticated.';
