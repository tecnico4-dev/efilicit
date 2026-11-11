-- LOCAL ONLY — avisos de favoritos (cambio de estado) + algún email en papelera.
-- Uso:
--   npx supabase db query --local -f scripts/local_seed_alice_favorite_notifications.sql
--
-- Alice: alice@example.com / password123
-- También siembra para tecnico4@eficen.com si existe.

do $$
declare
  v_alice uuid;
  v_tec uuid;
  v_auth uuid := 'b1111111-1111-4111-8111-111111111101';
  v_t1 uuid := 'b2222222-2222-4222-8222-222222222201';
  v_t2 uuid := 'b2222222-2222-4222-8222-222222222202';
  v_t3 uuid := 'b2222222-2222-4222-8222-222222222203';
  v_t4 uuid := 'b2222222-2222-4222-8222-222222222204';
  v_e1_ing uuid := 'b3333333-3333-4333-8333-333333333301';
  v_e1_upd uuid := 'b3333333-3333-4333-8333-333333333302';
  v_e2_ing uuid := 'b3333333-3333-4333-8333-333333333303';
  v_e2_upd uuid := 'b3333333-3333-4333-8333-333333333304';
  v_e3_ing uuid := 'b3333333-3333-4333-8333-333333333305';
  v_e3_upd uuid := 'b3333333-3333-4333-8333-333333333306';
  v_e4_ing uuid := 'b3333333-3333-4333-8333-333333333307';
  v_e4_upd uuid := 'b3333333-3333-4333-8333-333333333308';
  v_fav_at timestamptz := now() - interval '20 days';
  v_uid uuid;
  v_period_active text;
  v_period_trash text;
begin
  select u.id into v_alice
  from public.users u
  join auth.users au on au.id = u.auth_user_id
  where au.email = 'alice@example.com';

  if v_alice is null then
    raise exception 'No existe Alice (alice@example.com) en local';
  end if;

  select u.id into v_tec
  from public.users u
  join auth.users au on au.id = u.auth_user_id
  where au.email = 'tecnico4@eficen.com';

  insert into public.contracting_authorities (
    id, tax_id, name, name_normalized, identity_confidence, municipality, country
  ) values (
    v_auth,
    'P2807900C',
    'Ayuntamiento Demo Notificaciones',
    'ayuntamiento demo notificaciones',
    'HIGH',
    'Madrid',
    'ES'
  )
  on conflict (id) do update set name = excluded.name;

  insert into public.tenders (
    id, title, description, status, procedure_type, contract_type,
    estimated_value, currency, publication_date, deadline_at,
    contracting_authority_id, canonical_source_code,
    place_ccaa_code, created_at, updated_at
  ) values
    (
      v_t1,
      '[Demo] Suministro de portátiles para personal técnico',
      'Lote de equipos portátiles.',
      'adjudicada',
      'abierto',
      'suministros',
      85000,
      'EUR',
      (current_date - 40),
      (now() + interval '10 days'),
      v_auth,
      'demo_notif',
      '13',
      now() - interval '40 days',
      now()
    ),
    (
      v_t2,
      '[Demo] Servicio de limpieza de centros cívicos',
      'Limpieza ordinaria y especial.',
      'evaluacion',
      'abierto',
      'servicios',
      120000,
      'EUR',
      (current_date - 25),
      (now() + interval '5 days'),
      v_auth,
      'demo_notif',
      '13',
      now() - interval '25 days',
      now()
    ),
    (
      v_t3,
      '[Demo] Mantenimiento de red municipal',
      'Soporte y monitorización.',
      'publicada',
      'abierto',
      'servicios',
      45000,
      'EUR',
      (current_date - 15),
      (now() + interval '20 days'),
      v_auth,
      'demo_notif',
      '13',
      now() - interval '15 days',
      now()
    ),
    (
      v_t4,
      '[Demo] Obra de reforma en biblioteca',
      'Reforma de sala infantil.',
      'desierta',
      'abierto',
      'obras',
      210000,
      'EUR',
      (current_date - 50),
      (now() - interval '2 days'),
      v_auth,
      'demo_notif',
      '13',
      now() - interval '50 days',
      now()
    )
  on conflict (id) do update set
    title = excluded.title,
    status = excluded.status,
    updated_at = now();

  -- Favoritos (antes de los eventos de cambio).
  foreach v_uid in array array_remove(array[v_alice, v_tec], null)
  loop
    insert into public.favorites (user_id, tender_id, created_at)
    values
      (v_uid, v_t1, v_fav_at),
      (v_uid, v_t2, v_fav_at),
      (v_uid, v_t3, v_fav_at),
      (v_uid, v_t4, v_fav_at)
    on conflict (user_id, tender_id) do update
      set created_at = least(favorites.created_at, excluded.created_at);
  end loop;

  -- Eventos: ingerida (estado inicial) + actualizada (cambio) con created_at > favorito.
  delete from public.tender_events
  where id in (v_e1_ing, v_e1_upd, v_e2_ing, v_e2_upd, v_e3_ing, v_e3_upd, v_e4_ing, v_e4_upd);

  insert into public.tender_events (
    id, tender_id, event_type, event_status, occurred_at, source_code, created_at
  ) values
    -- T1: publicada → adjudicada (sin leer)
    (v_e1_ing, v_t1, 'ingerida', 'publicada',
      now() - interval '18 days', 'demo_notif', now() - interval '18 days'),
    (v_e1_upd, v_t1, 'actualizada', 'adjudicada',
      now() - interval '2 days', 'demo_notif', now() - interval '2 days'),
    -- T2: publicada → evaluacion (sin leer)
    (v_e2_ing, v_t2, 'ingerida', 'publicada',
      now() - interval '12 days', 'demo_notif', now() - interval '12 days'),
    (v_e2_upd, v_t2, 'actualizada', 'evaluacion',
      now() - interval '1 day', 'demo_notif', now() - interval '1 day'),
    -- T3: preparada → publicada (leído en buzón)
    (v_e3_ing, v_t3, 'ingerida', 'preparada',
      now() - interval '10 days', 'demo_notif', now() - interval '10 days'),
    (v_e3_upd, v_t3, 'actualizada', 'publicada',
      now() - interval '3 days', 'demo_notif', now() - interval '3 days'),
    -- T4: publicada → desierta (irá a papelera)
    (v_e4_ing, v_t4, 'ingerida', 'publicada',
      now() - interval '30 days', 'demo_notif', now() - interval '30 days'),
    (v_e4_upd, v_t4, 'actualizada', 'desierta',
      now() - interval '5 days', 'demo_notif', now() - interval '5 days');

  -- Estados UI: ensure + uno leído, uno en papelera, resto limpios.
  foreach v_uid in array array_remove(array[v_alice, v_tec], null)
  loop
    delete from public.notification_favorites
    where user_id = v_uid
      and event_id in (v_e1_upd, v_e2_upd, v_e3_upd, v_e4_upd);

    insert into public.notification_favorites (
      user_id, event_id, read_at, trashed_at, deleted
    ) values
      -- sin leer, en buzón
      (v_uid, v_e1_upd, null, null, false),
      (v_uid, v_e2_upd, null, null, false),
      -- leído, en buzón
      (v_uid, v_e3_upd, now() - interval '1 hour', null, false),
      -- en papelera (para probar restaurar / eliminar definitivo)
      (v_uid, v_e4_upd, null, now() - interval '2 days', false);

    -- Emails digest de demo (uno activo, uno en papelera). Periodos únicos por usuario.
    v_period_active := 'demo-fav-' || left(v_uid::text, 8) || '-a';
    v_period_trash := 'demo-fav-' || left(v_uid::text, 8) || '-b';

    delete from public.notification_emails
    where user_id = v_uid
      and digest_period in (v_period_active, v_period_trash);

    insert into public.notification_emails (
      user_id, frequency, digest_period, sent_at,
      tender_count, tender_ids, read_at, trashed_at
    ) values
      (
        v_uid, 'diaria', v_period_active,
        now() - interval '6 hours',
        2, array[v_t1, v_t2],
        null, null
      ),
      (
        v_uid, 'diaria', v_period_trash,
        now() - interval '3 days',
        2, array[v_t3, v_t4],
        now() - interval '2 days',
        now() - interval '1 day'
      );
  end loop;

  raise notice 'Seed OK: Alice=% Tecnico4=% — 4 cambios de estado + 2 emails (uno en papelera)',
    v_alice, v_tec;
end $$;
