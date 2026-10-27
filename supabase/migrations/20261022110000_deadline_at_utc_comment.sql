-- deadline_at: instante UTC (fuente naive = Europe/Madrid al normalizar).

comment on column public.tenders.deadline_at is
  'Plazo de presentación (timestamptz UTC). Fuente sin offset se interpreta como Europe/Madrid al normalizar.';
