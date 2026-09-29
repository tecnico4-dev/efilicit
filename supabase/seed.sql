-- Synthetic development seed (Fase 0 / Paso 8).
-- NO real users, tokens, passwords from production, or secrets.

-- Two local-only Auth users for RLS smoke tests.
-- Password for both (local only): "password123"
-- email_confirmed_at set so they can sign in immediately in Studio/local Auth.

create extension if not exists "pgcrypto";

do $$
declare
  user_a constant uuid := '11111111-1111-1111-1111-111111111111';
  user_b constant uuid := '22222222-2222-2222-2222-222222222222';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      user_a,
      'authenticated',
      'authenticated',
      'alice@example.com',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      user_b,
      'authenticated',
      'authenticated',
      'bob@example.com',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      user_a,
      user_a,
      format('{"sub":"%s","email":"alice@example.com"}', user_a)::jsonb,
      'email',
      user_a::text,
      now(),
      now(),
      now()
    ),
    (
      user_b,
      user_b,
      format('{"sub":"%s","email":"bob@example.com"}', user_b)::jsonb,
      'email',
      user_b::text,
      now(),
      now(),
      now()
    )
  on conflict (id) do nothing;

  insert into public.setup_rls_smoke (owner_id, note)
  values
    (user_a, 'Nota de Alice — solo ella debe verla con RLS'),
    (user_b, 'Nota de Bob — solo él debe verla con RLS');

  -- Semana 5: perfiles de aplicación (el trigger on_auth_user_created también los crea).
  insert into public.users (auth_user_id, display_name)
  values
    (user_a, 'Alice'),
    (user_b, 'Bob')
  on conflict (auth_user_id) do nothing;
end $$;
