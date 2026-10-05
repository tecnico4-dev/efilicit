-- Preferencia de digest a nivel de cuenta (Semana 5 / ADR 012).
-- daily | weekly; un correo por periodo (no por alerta).
-- instant queda fuera del MVP (BACKLOG); no ampliar el CHECK sin ADR.

alter table public.users
  add column if not exists digest_frequency text not null default 'daily'
    check (digest_frequency in ('daily', 'weekly'));

comment on column public.users.digest_frequency is
  'Frecuencia del email de alertas de la cuenta (daily|weekly). '
  'Aplica a todas las alertas del usuario; un correo por periodo. '
  'instant no forma parte del MVP.';
