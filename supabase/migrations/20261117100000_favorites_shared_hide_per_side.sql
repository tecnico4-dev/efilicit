-- Peer share: ocultar por lado (from/to). Si ambos ocultan → DELETE.
-- Listados: SELECT RLS solo filas con el lado propio visible.
-- ADR 032 (addendum hide-per-side).

alter table public.favorites_shared
  add column if not exists hidden_by_from_at timestamptz null,
  add column if not exists hidden_by_to_at timestamptz null;

comment on column public.favorites_shared.hidden_by_from_at is
  'Cuando el emisor quita el share de su bandeja; null = visible para from.';
comment on column public.favorites_shared.hidden_by_to_at is
  'Cuando el destinatario quita el share de su bandeja; null = visible para to.';

-- SELECT: solo si mi lado no está oculto (el otro puede seguir viéndolo).
drop policy if exists "favorites_shared_select_party" on public.favorites_shared;

create policy "favorites_shared_select_party"
  on public.favorites_shared for select to authenticated
  using (
    public.is_app_user()
    and (
      (
        from_user_id in (
          select id from public.users where auth_user_id = (select auth.uid())
        )
        and hidden_by_from_at is null
      )
      or (
        to_user_id in (
          select id from public.users where auth_user_id = (select auth.uid())
        )
        and hidden_by_to_at is null
      )
    )
  );

-- Quitar = hide del lado propio; si ambos hidden → DELETE.
-- SECURITY DEFINER: tras hide el SELECT RLS ya no devolvería la fila.
create or replace function public.hide_favorite_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_from uuid;
  v_to uuid;
  v_hidden_from timestamptz;
  v_hidden_to timestamptz;
begin
  if not public.is_app_user() then
    raise exception 'hide_favorite_share: not app user';
  end if;

  select u.id into v_user_id
  from public.users u
  where u.auth_user_id = (select auth.uid());

  if v_user_id is null then
    raise exception 'hide_favorite_share: no profile';
  end if;

  select fs.from_user_id, fs.to_user_id, fs.hidden_by_from_at, fs.hidden_by_to_at
  into v_from, v_to, v_hidden_from, v_hidden_to
  from public.favorites_shared fs
  where fs.id = p_share_id
  for update;

  if not found then
    raise exception 'hide_favorite_share: not found';
  end if;

  if v_user_id = v_from then
    v_hidden_from := coalesce(v_hidden_from, now());
  elsif v_user_id = v_to then
    v_hidden_to := coalesce(v_hidden_to, now());
  else
    raise exception 'hide_favorite_share: not a party';
  end if;

  if v_hidden_from is not null and v_hidden_to is not null then
    delete from public.favorites_shared where id = p_share_id;
  else
    update public.favorites_shared
    set
      hidden_by_from_at = v_hidden_from,
      hidden_by_to_at = v_hidden_to
    where id = p_share_id;
  end if;
end;
$$;

comment on function public.hide_favorite_share(uuid) is
  'Oculta favorites_shared para el lado del caller; DELETE si ambos lados ocultos.';

revoke all on function public.hide_favorite_share(uuid) from public;
revoke all on function public.hide_favorite_share(uuid) from anon;
grant execute on function public.hide_favorite_share(uuid) to authenticated;

-- Reenviar solo si la fila existe y algún lado estaba oculto.
-- Returns: reactivated | already | missing
create or replace function public.reactivate_favorite_share(
  p_tender_id uuid,
  p_to_user_id uuid,
  p_kind text,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_hidden_from timestamptz;
  v_hidden_to timestamptz;
begin
  if not public.is_app_user() then
    raise exception 'reactivate_favorite_share: not app user';
  end if;

  if p_kind is null or p_kind not in ('propia', 'subcontrata') then
    raise exception 'reactivate_favorite_share: invalid kind';
  end if;

  select u.id into v_user_id
  from public.users u
  where u.auth_user_id = (select auth.uid());

  if v_user_id is null then
    raise exception 'reactivate_favorite_share: no profile';
  end if;

  if p_to_user_id is null or p_to_user_id = v_user_id then
    raise exception 'reactivate_favorite_share: invalid to_user';
  end if;

  select fs.hidden_by_from_at, fs.hidden_by_to_at
  into v_hidden_from, v_hidden_to
  from public.favorites_shared fs
  where fs.tender_id = p_tender_id
    and fs.from_user_id = v_user_id
    and fs.to_user_id = p_to_user_id
  for update;

  if not found then
    return 'missing';
  end if;

  if v_hidden_from is null and v_hidden_to is null then
    return 'already';
  end if;

  update public.favorites_shared
  set
    hidden_by_from_at = null,
    hidden_by_to_at = null,
    kind = p_kind,
    notes = case
      when p_notes is null or length(trim(p_notes)) = 0 then null
      else left(trim(p_notes), 500)
    end
  where tender_id = p_tender_id
    and from_user_id = v_user_id
    and to_user_id = p_to_user_id;

  return 'reactivated';
end;
$$;

comment on function public.reactivate_favorite_share(uuid, uuid, text, text) is
  'Si el share del caller está oculto en algún lado, limpia hides y actualiza kind/notes. Devuelve reactivated|already|missing.';

revoke all on function public.reactivate_favorite_share(uuid, uuid, text, text) from public;
revoke all on function public.reactivate_favorite_share(uuid, uuid, text, text) from anon;
grant execute on function public.reactivate_favorite_share(uuid, uuid, text, text) to authenticated;
