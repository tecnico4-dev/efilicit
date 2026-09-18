-- Semana 4 / Paso 4: matching multi-fuente en tender_sources.
-- Campos del roadmap: match_method, match_score, matched_at, review_status.
-- canonical_tender_id = tender_id (ya existía). Sin tabla auxiliar todavía.

alter table public.tender_sources
  add column match_method text,
  add column match_score numeric(6, 4),
  add column matched_at timestamptz,
  add column review_status text not null default 'unmatched'
    check (review_status in ('unmatched', 'auto', 'pending'));

comment on column public.tender_sources.match_method is
  'Cómo se enlazó esta fila a tenders.id (p. ej. expediente+organismo, cpv+importe). Null si unmatched.';

comment on column public.tender_sources.match_score is
  'Confianza del match en [0, 1] cuando aplica. Null si unmatched.';

comment on column public.tender_sources.matched_at is
  'Momento en que se registró el match auto o pending.';

comment on column public.tender_sources.review_status is
  'unmatched = sin match multi-fuente; auto = fusionado con alta confianza; pending = ambiguo, no fusionar a ciegas.';

comment on table public.tender_sources is
  'Enlace multi-fuente: upsert idempotente por (source_code, source_tender_id). Matching Semana 4 vía match_* / review_status.';

create index tender_sources_review_status_idx
  on public.tender_sources (review_status)
  where review_status = 'pending';
