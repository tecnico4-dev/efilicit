-- Deshacer hide por lado (toast Revertir). SECURITY DEFINER: tras hide el SELECT RLS oculta la fila.

create or replace function public.unhide_favorite_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_from uuid;
  v_to uuid;
begin
  if not public.is_app_user() then
    raise exception 'unhide_favorite_share: not app user';
  end if;

  select u.id into v_user_id
  from public.users u
  where u.auth_user_id = (select auth.uid());

  if v_user_id is null then
    raise exception 'unhide_favorite_share: no profile';
  end if;

  select fs.from_user_id, fs.to_user_id
  into v_from, v_to
  from public.favorites_shared fs
  where fs.id = p_share_id
  for update;

  if not found then
    raise exception 'unhide_favorite_share: not found';
  end if;

  if v_user_id = v_from then
    update public.favorites_shared
    set hidden_by_from_at = null
    where id = p_share_id;
  elsif v_user_id = v_to then
    update public.favorites_shared
    set hidden_by_to_at = null
    where id = p_share_id;
  else
    raise exception 'unhide_favorite_share: not a party';
  end if;
end;
$$;

comment on function public.unhide_favorite_share(uuid) is
  'Limpia el hide del lado del caller (Revertir tras quitar de la bandeja peer).';

revoke all on function public.unhide_favorite_share(uuid) from public;
revoke all on function public.unhide_favorite_share(uuid) from anon;
grant execute on function public.unhide_favorite_share(uuid) to authenticated;
