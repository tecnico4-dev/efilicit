-- Puntuación 1–5 de licitaciones por usuario (buzón / interés).
-- Una fila = una nota; sin fila = sin puntuar. Owner-only RLS.

create table public.tender_ratings (
  user_id uuid not null references public.users (id) on delete cascade,
  tender_id uuid not null references public.tenders (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tender_id)
);

comment on table public.tender_ratings is
  'Nota 1–5 que un usuario da a una licitación (p. ej. desde el buzón de digest).';

create index tender_ratings_tender_id_idx on public.tender_ratings (tender_id);
create index tender_ratings_user_id_updated_at_idx
  on public.tender_ratings (user_id, updated_at desc);

alter table public.tender_ratings enable row level security;

create policy "tender_ratings_select_own"
  on public.tender_ratings for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "tender_ratings_insert_own"
  on public.tender_ratings for insert to authenticated
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "tender_ratings_update_own"
  on public.tender_ratings for update to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  )
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "tender_ratings_delete_own"
  on public.tender_ratings for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

revoke all on table public.tender_ratings from public;
revoke all on table public.tender_ratings from anon;
grant select, insert, update, delete on table public.tender_ratings to authenticated;
