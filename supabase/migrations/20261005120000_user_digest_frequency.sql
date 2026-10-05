-- Preferencia de digest a nivel de cuenta (Semana 5).
-- daily | weekly; instant queda fuera del MVP (BACKLOG).

alter table public.users
  add column if not exists digest_frequency text not null default 'daily'
    check (digest_frequency in ('daily', 'weekly'));

comment on column public.users.digest_frequency is
  'Frecuencia del email de alertas de la cuenta (daily|weekly). '
  'Aplica a todas las alertas del usuario; un correo por periodo. '
  'instant no forma parte del MVP.';
