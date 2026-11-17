-- Recomendaciones por usuario y perfil (propia | subcontrata).
-- Escribe el job batch; la web solo lee (ADR 034).

create table public.tender_recommendations (
  user_id uuid not null references public.users (id) on delete cascade,
  profile_kind text not null
    check (profile_kind in ('propia', 'subcontrata')),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  score numeric(5, 4) not null,
  reason jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (user_id, profile_kind, tender_id)
);

comment on table public.tender_recommendations is
  'ADR 034: licitaciones recomendadas (batch). Una fila por usuario + perfil + tender.';

comment on column public.tender_recommendations.profile_kind is
  'propia = Eficen; subcontrata. Nunca mezclar en el mismo ranking.';

comment on column public.tender_recommendations.reason is
  'Motivo UI: seed, señal dominante, boost empresa, etc.';

create index tender_recommendations_user_computed_idx
  on public.tender_recommendations (user_id, computed_at desc);

create index tender_recommendations_user_profile_score_idx
  on public.tender_recommendations (user_id, profile_kind, score desc);

alter table public.tender_recommendations enable row level security;

create policy "tender_recommendations_select_own"
  on public.tender_recommendations for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

revoke all on table public.tender_recommendations from public;
revoke all on table public.tender_recommendations from anon;
grant select on table public.tender_recommendations to authenticated;
-- insert/update/delete: solo roles de confianza (job con connection string).
