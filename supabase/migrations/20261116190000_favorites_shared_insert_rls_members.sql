-- INSERT favorites_shared: no validar to_user_id vía public.users (RLS own-only
-- hacía fallar el WITH CHECK al enviar a un compañero). Validar con eficen_members
-- (SELECT is_app_user). ADR 032.

drop policy if exists "favorites_shared_insert_from" on public.favorites_shared;

create policy "favorites_shared_insert_from"
  on public.favorites_shared for insert to authenticated
  with check (
    public.is_app_user()
    and from_user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
    and to_user_id in (
      select user_id
      from public.eficen_members
      where user_id is not null
        and active
    )
    and from_user_id <> to_user_id
  );

comment on table public.favorites_shared is
  'Favoritos compartidos peer-to-peer: una fila por destinatario (ADR 032). INSERT: to_user_id debe ser miembro activo con cuenta.';
