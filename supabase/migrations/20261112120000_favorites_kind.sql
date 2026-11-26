-- Favoritos personales: propia (Eficen) vs subcontrata.

alter table public.favorites
  add column if not exists kind text;

update public.favorites
set kind = 'propia'
where kind is null;

alter table public.favorites
  alter column kind set not null;

alter table public.favorites
  drop constraint if exists favorites_kind_check;

alter table public.favorites
  add constraint favorites_kind_check
  check (kind in ('propia', 'subcontrata'));

comment on column public.favorites.kind is
  'propia = Eficen como adjudicataria/interesada; subcontrata = vía subcontrata.';
