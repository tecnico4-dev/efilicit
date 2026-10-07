-- Semana 4: candidato best en pending (columna en tender_sources). ADR 010.
-- Solo informativo para revisión humana futura; no implica fusión.
-- Evolución prevista: tabla match_suggestions (N candidatos) cuando exista UI de revisión.

alter table public.tender_sources
  add column match_candidate_tender_id uuid
    references public.tenders (id) on delete set null;

comment on column public.tender_sources.match_candidate_tender_id is
  'Best tender sugerido cuando review_status=pending (no fusionado). Null en auto/unmatched. Evolución futura: tabla match_suggestions para N candidatos.';

create index tender_sources_match_candidate_tender_id_idx
  on public.tender_sources (match_candidate_tender_id)
  where match_candidate_tender_id is not null;
