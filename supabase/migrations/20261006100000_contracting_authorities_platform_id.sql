-- Identidad de organismos sin NIF/CIF: persistir platform_id (p. ej. DIR3)
-- y upsert idempotente para no acumular filas huérfanas en re-ingestas
-- (Catalunya SODA y otras fuentes sin tax_id). Ver ADR 014.

alter table public.contracting_authorities
  add column if not exists platform_id text;

comment on column public.contracting_authorities.platform_id is
  'Identificador de plataforma/fuente del organismo (p. ej. DIR3, id de portal). '
  'Señal secundaria cuando no hay tax_id; NIF/CIF sigue siendo primario.';

-- Solo filas sin tax_id: evita choque si más adelante el mismo DIR3 llega con NIF
-- en otra fila (fusión cross-fuente de organismos queda fuera de este ADR).
create unique index if not exists contracting_authorities_platform_id_uidx
  on public.contracting_authorities (tax_id_country, platform_id)
  where platform_id is not null and tax_id is null;

create index if not exists contracting_authorities_platform_id_idx
  on public.contracting_authorities (platform_id)
  where platform_id is not null;
