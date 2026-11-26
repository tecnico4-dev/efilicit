-- Común: propia (Eficen) vs subcontrata.

alter table public.shared_favorites
  add column if not exists kind text;

update public.shared_favorites
set kind = 'propia'
where kind is null;

alter table public.shared_favorites
  alter column kind set not null;

alter table public.shared_favorites
  drop constraint if exists shared_favorites_kind_check;

alter table public.shared_favorites
  add constraint shared_favorites_kind_check
  check (kind in ('propia', 'subcontrata'));

comment on column public.shared_favorites.kind is
  'propia = Eficen como adjudicataria/interesada; subcontrata = vía subcontrata.';
