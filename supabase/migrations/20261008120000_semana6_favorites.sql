-- Semana 6 / Paso 5: favoritos / seguimiento de licitaciones.
-- RLS owner-only: un usuario no ve ni modifica favoritos de otro.

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  tender_id uuid not null references public.tenders (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, tender_id)
);

comment on table public.favorites is
  'Seguimiento de licitaciones canónicas por usuario (Semana 6).';

create index favorites_user_id_idx on public.favorites (user_id);
create index favorites_tender_id_idx on public.favorites (tender_id);
create index favorites_user_id_created_at_idx
  on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

create policy "favorites_select_own"
  on public.favorites for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "favorites_insert_own"
  on public.favorites for insert to authenticated
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "favorites_delete_own"
  on public.favorites for delete to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

revoke all on table public.favorites from public;
revoke all on table public.favorites from anon;

grant select, insert, delete on table public.favorites to authenticated;
