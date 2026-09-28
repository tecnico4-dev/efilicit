-- Semana 5 / Paso 2: búsqueda FTS + pg_trgm sobre tenders.
-- Pesos: título (A) > descripción (B). Geografía: join a contracting_authorities (sin columna nueva).
-- B-tree de filtros (fecha, importe, estado, CPV, deadline) ya existen desde Semana 1.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- search_vector: generado y almacenado; se recalcula al cambiar title/description
-- ---------------------------------------------------------------------------
alter table public.tenders
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A')
    || setweight(to_tsvector('spanish', coalesce(description, '')), 'B')
  ) stored;

comment on column public.tenders.search_vector is
  'FTS Semana 5: título peso A, descripción peso B (config spanish). Solo lectura.';

-- ---------------------------------------------------------------------------
-- Índices: GIN FTS + trigram (erratas) sobre título
-- ---------------------------------------------------------------------------
create index tenders_search_vector_gin_idx
  on public.tenders using gin (search_vector);

create index tenders_title_trgm_idx
  on public.tenders using gin (title gin_trgm_ops);

comment on index public.tenders_search_vector_gin_idx is
  'Full Text Search (GIN) sobre tenders.search_vector.';

comment on index public.tenders_title_trgm_idx is
  'Similitud / erratas (pg_trgm) sobre tenders.title.';
