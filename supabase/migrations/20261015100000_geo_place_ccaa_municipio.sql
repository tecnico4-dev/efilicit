-- Lugar de ejecución canónico: catálogo CCAA/municipio + columnas en tenders.
-- Geografía ≠ source_code. Provincia aplazada. ADR 018.

-- ---------------------------------------------------------------------------
-- geo_ccaa — catálogo (códigos INE de comunidad)
-- ---------------------------------------------------------------------------
create table public.geo_ccaa (
  code text primary key,
  name text not null
);

comment on table public.geo_ccaa is
  'Catálogo de comunidades/ciudades autónomas (código INE). Solo lectura app.';

comment on column public.geo_ccaa.code is
  'Código INE de CCAA (01–19).';

insert into public.geo_ccaa (code, name) values
  ('01', 'Andalucía'),
  ('02', 'Aragón'),
  ('03', 'Principado de Asturias'),
  ('04', 'Illes Balears'),
  ('05', 'Canarias'),
  ('06', 'Cantabria'),
  ('07', 'Castilla y León'),
  ('08', 'Castilla-La Mancha'),
  ('09', 'Cataluña'),
  ('10', 'Comunitat Valenciana'),
  ('11', 'Extremadura'),
  ('12', 'Galicia'),
  ('13', 'Comunidad de Madrid'),
  ('14', 'Región de Murcia'),
  ('15', 'Comunidad Foral de Navarra'),
  ('16', 'País Vasco'),
  ('17', 'La Rioja'),
  ('18', 'Ciudad Autónoma de Ceuta'),
  ('19', 'Ciudad Autónoma de Melilla');

-- ---------------------------------------------------------------------------
-- geo_municipio — catálogo (código INE 5 dígitos); seed vacío (carga en bloque)
-- ---------------------------------------------------------------------------
create table public.geo_municipio (
  code text primary key,
  name text not null,
  ccaa_code text not null references public.geo_ccaa (code)
);

comment on table public.geo_municipio is
  'Catálogo de municipios (código INE). Seed vacío hasta carga en bloque; FK a geo_ccaa.';

comment on column public.geo_municipio.code is
  'Código INE de municipio (5 dígitos: provincia+municipio).';

create index geo_municipio_ccaa_code_idx on public.geo_municipio (ccaa_code);

-- ---------------------------------------------------------------------------
-- tenders — lugar de ejecución (códigos; nombres vía join al catálogo)
-- ---------------------------------------------------------------------------
alter table public.tenders
  add column if not exists place_nuts_code text,
  add column if not exists place_ccaa_code text
    references public.geo_ccaa (code),
  add column if not exists place_municipality_code text
    references public.geo_municipio (code);

comment on column public.tenders.place_nuts_code is
  'NUTS del lugar de ejecución (primer código si la fuente trae varios).';

comment on column public.tenders.place_ccaa_code is
  'CCAA del lugar de ejecución (catálogo geo_ccaa); suele derivarse del NUTS.';

comment on column public.tenders.place_municipality_code is
  'Municipio INE del lugar de ejecución cuando la fuente lo aporta con código fiable; si no, null.';

create index tenders_place_ccaa_code_idx
  on public.tenders (place_ccaa_code)
  where place_ccaa_code is not null;

create index tenders_place_municipality_code_idx
  on public.tenders (place_municipality_code)
  where place_municipality_code is not null;

create index tenders_place_nuts_code_idx
  on public.tenders (place_nuts_code)
  where place_nuts_code is not null;

-- ---------------------------------------------------------------------------
-- RLS: catálogo público de lectura; escritura solo service_role / owner DB
-- ---------------------------------------------------------------------------
alter table public.geo_ccaa enable row level security;
alter table public.geo_municipio enable row level security;

create policy "geo_ccaa_select_public"
  on public.geo_ccaa for select to anon, authenticated using (true);

create policy "geo_municipio_select_public"
  on public.geo_municipio for select to anon, authenticated using (true);

revoke all on table public.geo_ccaa from public;
revoke all on table public.geo_municipio from public;
revoke all on table public.geo_ccaa from anon;
revoke all on table public.geo_municipio from anon;

grant select on table public.geo_ccaa to anon, authenticated;
grant select on table public.geo_municipio to anon, authenticated;
