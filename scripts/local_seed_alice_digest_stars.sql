-- LOCAL ONLY — escenario para probar estrellas en el buzón de Alice.
-- No es migración. Uso:
--   npx supabase db query --local -f scripts/local_seed_alice_digest_stars.sql
--
-- Alice: alice@example.com / password123

do $$
declare
  v_alice uuid;
  v_auth uuid := 'a1111111-1111-4111-8111-111111111101';
  v_alert uuid := 'a3333333-3333-4333-8333-333333333301';
  v_t1 uuid := 'a2222222-2222-4222-8222-222222222201';
  v_t2 uuid := 'a2222222-2222-4222-8222-222222222202';
  v_t3 uuid := 'a2222222-2222-4222-8222-222222222203';
  v_t4 uuid := 'a2222222-2222-4222-8222-222222222204';
  v_t5 uuid := 'a2222222-2222-4222-8222-222222222205';
  v_digest text := '2026-11-02';
begin
  select u.id into v_alice
  from public.users u
  join auth.users au on au.id = u.auth_user_id
  where au.email = 'alice@example.com';

  if v_alice is null then
    raise exception 'No existe Alice (alice@example.com) en local';
  end if;

  insert into public.contracting_authorities (
    id, tax_id, name, name_normalized, identity_confidence, municipality, country
  ) values (
    v_auth,
    'P2807900B',
    'Ayuntamiento Demo Estrellas',
    'ayuntamiento demo estrellas',
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
      'Mantenimiento de software de gestión municipal',
      'Servicio de mantenimiento correctivo y evolutivo.',
      'publicada', 'abierto', 'servicios',
      45000, 'EUR', current_date - 3, now() + interval '20 days',
      v_auth, 'demo_stars', '13', now(), now()
    ),
    (
      v_t2,
      'Suministro de material de oficina ecológico',
      'Lote único de material de oficina.',
      'publicada', 'abierto', 'suministros',
      12000, 'EUR', current_date - 2, now() + interval '15 days',
      v_auth, 'demo_stars', '13', now(), now()
    ),
    (
      v_t3,
      'Servicio de limpieza de edificios administrativos',
      'Limpieza diaria y especial.',
      'publicada', 'abierto', 'servicios',
      180000, 'EUR', current_date - 5, now() + interval '30 days',
      v_auth, 'demo_stars', '13', now(), now()
    ),
    (
      v_t4,
      'Desarrollo de portal web de contratación',
      'Diseño y desarrollo del portal.',
      'publicada', 'abierto', 'servicios',
      95000, 'EUR', current_date - 1, now() + interval '25 days',
      v_auth, 'demo_stars', '09', now(), now()
    ),
    (
      v_t5,
      'Formación en ciberseguridad para personal técnico',
      'Curso presencial y online.',
      'publicada', 'negociado', 'servicios',
      22000, 'EUR', current_date, now() + interval '10 days',
      v_auth, 'demo_stars', '13', now(), now()
    )
  on conflict (id) do update set
    title = excluded.title,
    updated_at = now();

  delete from public.tender_sources where tender_id in (v_t1, v_t2, v_t3, v_t4, v_t5);
  insert into public.tender_sources (
    tender_id, source_code, source_tender_id, source_url,
    match_method, review_status
  ) values
    (v_t1, 'demo_stars', 'DEMO-SOFT-001', 'https://example.invalid/demo/soft-001', 'auto', 'auto'),
    (v_t2, 'demo_stars', 'DEMO-OFI-002', 'https://example.invalid/demo/ofi-002', 'auto', 'auto'),
    (v_t3, 'demo_stars', 'DEMO-LIM-003', 'https://example.invalid/demo/lim-003', 'auto', 'auto'),
    (v_t4, 'demo_stars', 'DEMO-WEB-004', 'https://example.invalid/demo/web-004', 'auto', 'auto'),
    (v_t5, 'demo_stars', 'DEMO-CYB-005', 'https://example.invalid/demo/cyb-005', 'auto', 'auto');

  delete from public.tender_cpvs where tender_id in (v_t1, v_t2, v_t3, v_t4, v_t5);
  insert into public.tender_cpvs (tender_id, cpv_code) values
    (v_t1, '72000000'),
    (v_t2, '30192000'),
    (v_t3, '90910000'),
    (v_t4, '72400000'),
    (v_t5, '80510000');

  insert into public.alerts (
    id, user_id, name, criteria, kind, is_active, created_at, updated_at
  ) values (
    v_alert,
    v_alice,
    'Demo estrellas — software y servicios',
    jsonb_build_object(
      'version', 1,
      'keywords', jsonb_build_array('software', 'formación', 'portal', 'limpieza', 'oficina')
    ),
    'propia',
    true,
    now(),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    criteria = excluded.criteria,
    kind = excluded.kind,
    is_active = true,
    updated_at = now();

  -- Cola como si el digest ya se hubiera enviado (opcional, coherencia).
  delete from public.notification_queue
  where user_id = v_alice
    and payload->>'kind' = 'alert_match_demo_stars';

  insert into public.notification_queue (
    user_id, alert_id, status, idempotency_key, attempts, payload, scheduled_at, sent_at
  ) values
    (
      v_alice, v_alert, 'sent',
      'alert:' || v_alert::text || ':tender:' || v_t1::text, 1,
      jsonb_build_object(
        'tender_id', v_t1, 'alert_id', v_alert, 'title', 'Mantenimiento de software de gestión municipal',
        'frequency', 'diaria', 'channel', 'email', 'kind', 'alert_match_demo_stars'
      ),
      now() - interval '1 hour', now() - interval '30 minutes'
    ),
    (
      v_alice, v_alert, 'sent',
      'alert:' || v_alert::text || ':tender:' || v_t2::text, 1,
      jsonb_build_object(
        'tender_id', v_t2, 'alert_id', v_alert, 'title', 'Suministro de material de oficina ecológico',
        'frequency', 'diaria', 'channel', 'email', 'kind', 'alert_match_demo_stars'
      ),
      now() - interval '1 hour', now() - interval '30 minutes'
    ),
    (
      v_alice, v_alert, 'sent',
      'alert:' || v_alert::text || ':tender:' || v_t3::text, 1,
      jsonb_build_object(
        'tender_id', v_t3, 'alert_id', v_alert, 'title', 'Servicio de limpieza de edificios administrativos',
        'frequency', 'diaria', 'channel', 'email', 'kind', 'alert_match_demo_stars'
      ),
      now() - interval '1 hour', now() - interval '30 minutes'
    ),
    (
      v_alice, v_alert, 'sent',
      'alert:' || v_alert::text || ':tender:' || v_t4::text, 1,
      jsonb_build_object(
        'tender_id', v_t4, 'alert_id', v_alert, 'title', 'Desarrollo de portal web de contratación',
        'frequency', 'diaria', 'channel', 'email', 'kind', 'alert_match_demo_stars'
      ),
      now() - interval '1 hour', now() - interval '30 minutes'
    ),
    (
      v_alice, v_alert, 'sent',
      'alert:' || v_alert::text || ':tender:' || v_t5::text, 1,
      jsonb_build_object(
        'tender_id', v_t5, 'alert_id', v_alert, 'title', 'Formación en ciberseguridad para personal técnico',
        'frequency', 'diaria', 'channel', 'email', 'kind', 'alert_match_demo_stars'
      ),
      now() - interval '1 hour', now() - interval '30 minutes'
    );

  delete from public.notification_emails
  where user_id = v_alice
    and digest_period = v_digest
    and frequency = 'diaria';

  insert into public.notification_emails (
    user_id, frequency, digest_period, sent_at, tender_count, tender_ids, read_at
  ) values (
    v_alice,
    'diaria',
    v_digest,
    now() - interval '30 minutes',
    5,
    array[v_t1, v_t2, v_t3, v_t4, v_t5]::uuid[],
    null
  );

  raise notice 'OK: Alice %, alerta %, digest %, 5 licitaciones demo',
    v_alice, v_alert, v_digest;
end $$;
