-- Peer shares: N filas (una por destinatario). UNIQUE (tender, from, to).
-- ADR 032.

create table public.favorites_shared (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  from_user_id uuid not null references public.users (id) on delete restrict,
  to_user_id uuid not null references public.users (id) on delete restrict,
  kind text not null
    constraint favorites_shared_kind_check
      check (kind in ('propia', 'subcontrata')),
  notes text null
    constraint favorites_shared_notes_check
      check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint favorites_shared_from_ne_to
    check (from_user_id <> to_user_id),
  constraint favorites_shared_tender_from_to_key
    unique (tender_id, from_user_id, to_user_id)
);

comment on table public.favorites_shared is
  'Favoritos compartidos peer-to-peer: una fila por destinatario (ADR 032).';

comment on column public.favorites_shared.kind is
  'propia | subcontrata; heredado del favorito personal al enviar.';

create index favorites_shared_to_created_idx
  on public.favorites_shared (to_user_id, created_at desc);

create index favorites_shared_from_created_idx
  on public.favorites_shared (from_user_id, created_at desc);

create index favorites_shared_tender_idx
  on public.favorites_shared (tender_id);

alter table public.favorites_shared enable row level security;

create policy "favorites_shared_select_party"
  on public.favorites_shared for select to authenticated
  using (
    public.is_app_user()
    and (
      from_user_id in (
        select id from public.users where auth_user_id = (select auth.uid())
      )
      or to_user_id in (
        select id from public.users where auth_user_id = (select auth.uid())
      )
    )
  );

create policy "favorites_shared_insert_from"
  on public.favorites_shared for insert to authenticated
  with check (
    public.is_app_user()
    and from_user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
    and to_user_id in (select id from public.users)
    and from_user_id <> to_user_id
  );

create policy "favorites_shared_delete_party"
  on public.favorites_shared for delete to authenticated
  using (
    public.is_app_user()
    and (
      from_user_id in (
        select id from public.users where auth_user_id = (select auth.uid())
      )
      or to_user_id in (
        select id from public.users where auth_user_id = (select auth.uid())
      )
    )
  );

revoke all on table public.favorites_shared from public;
revoke all on table public.favorites_shared from anon;
grant select, insert, delete on table public.favorites_shared to authenticated;
