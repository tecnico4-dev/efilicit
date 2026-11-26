-- ADR 034 (enmienda): una fila por (user, tender).
-- Si ambos perfiles empatan a score → profile_kind NULL (solo lista Todas).

alter table public.tender_recommendations
  drop constraint tender_recommendations_pkey;

alter table public.tender_recommendations
  drop constraint if exists tender_recommendations_profile_kind_check;

alter table public.tender_recommendations
  alter column profile_kind drop not null;

alter table public.tender_recommendations
  add constraint tender_recommendations_profile_kind_check
  check (
    profile_kind is null
    or profile_kind in ('propia', 'subcontrata')
  );

-- Deduplicar filas existentes: mayor score; empate de máximos → kind null.
create temporary table _tender_recommendations_deduped on commit drop as
with scored as (
  select
    *,
    max(score) over (partition by user_id, tender_id) as max_score
  from public.tender_recommendations
)
select
  user_id,
  tender_id,
  max_score as score,
  case
    when count(*) filter (
      where score = max_score and profile_kind = 'propia'
    ) > 0
    and count(*) filter (
      where score = max_score and profile_kind = 'subcontrata'
    ) > 0
    then null
    else max(profile_kind) filter (where score = max_score)
  end as profile_kind,
  (array_agg(reason order by score desc, profile_kind nulls last))[1] as reason,
  max(computed_at) as computed_at
from scored
group by user_id, tender_id, max_score;

delete from public.tender_recommendations;

insert into public.tender_recommendations (
  user_id, profile_kind, tender_id, score, reason, computed_at
)
select
  user_id, profile_kind, tender_id, score, reason, computed_at
from _tender_recommendations_deduped;

alter table public.tender_recommendations
  add primary key (user_id, tender_id);

comment on table public.tender_recommendations is
  'ADR 034: licitaciones recomendadas (batch). Una fila por usuario + tender; profile_kind del mejor score (null si empate).';

comment on column public.tender_recommendations.profile_kind is
  'propia | subcontrata | null (empate de scores entre perfiles).';
