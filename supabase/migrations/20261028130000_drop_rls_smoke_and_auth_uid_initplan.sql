-- 1) Quita andamiaje Fase 0 `setup_rls_smoke` (BACKLOG / inventario RLS).
-- 2) Políticas owner-only: auth.uid() → (select auth.uid()) (advisor auth_rls_initplan).

-- ---------------------------------------------------------------------------
-- Drop smoke table
-- ---------------------------------------------------------------------------
drop table if exists public.setup_rls_smoke;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own" on public.users;
drop policy if exists "users_insert_own" on public.users;

create policy "users_select_own"
  on public.users for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "users_update_own"
  on public.users for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy "users_insert_own"
  on public.users for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- saved_searches
-- ---------------------------------------------------------------------------
drop policy if exists "saved_searches_select_own" on public.saved_searches;
drop policy if exists "saved_searches_insert_own" on public.saved_searches;
drop policy if exists "saved_searches_update_own" on public.saved_searches;
drop policy if exists "saved_searches_delete_own" on public.saved_searches;

create policy "saved_searches_select_own"
  on public.saved_searches for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "saved_searches_insert_own"
  on public.saved_searches for insert to authenticated
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "saved_searches_update_own"
  on public.saved_searches for update to authenticated
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

create policy "saved_searches_delete_own"
  on public.saved_searches for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
drop policy if exists "alerts_select_own" on public.alerts;
drop policy if exists "alerts_insert_own" on public.alerts;
drop policy if exists "alerts_update_own" on public.alerts;
drop policy if exists "alerts_delete_own" on public.alerts;

create policy "alerts_select_own"
  on public.alerts for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "alerts_insert_own"
  on public.alerts for insert to authenticated
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "alerts_update_own"
  on public.alerts for update to authenticated
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

create policy "alerts_delete_own"
  on public.alerts for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- notification_queue
-- ---------------------------------------------------------------------------
drop policy if exists "notification_queue_select_own" on public.notification_queue;

create policy "notification_queue_select_own"
  on public.notification_queue for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;

create policy "favorites_select_own"
  on public.favorites for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "favorites_insert_own"
  on public.favorites for insert to authenticated
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "favorites_delete_own"
  on public.favorites for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- notification_reads
-- ---------------------------------------------------------------------------
drop policy if exists "notification_reads_select_own" on public.notification_reads;
drop policy if exists "notification_reads_insert_own" on public.notification_reads;
drop policy if exists "notification_reads_delete_own" on public.notification_reads;

create policy "notification_reads_select_own"
  on public.notification_reads for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_reads_insert_own"
  on public.notification_reads for insert to authenticated
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_reads_delete_own"
  on public.notification_reads for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- notification_trash
-- ---------------------------------------------------------------------------
drop policy if exists "notification_trash_select_own" on public.notification_trash;
drop policy if exists "notification_trash_insert_own" on public.notification_trash;
drop policy if exists "notification_trash_delete_own" on public.notification_trash;
drop policy if exists "notification_trash_update_own" on public.notification_trash;

create policy "notification_trash_select_own"
  on public.notification_trash for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_trash_insert_own"
  on public.notification_trash for insert to authenticated
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_trash_delete_own"
  on public.notification_trash for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_trash_update_own"
  on public.notification_trash for update to authenticated
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
