-- Nombres de CCAA en castellano (formato homogéneo en UI / ficha).
-- Illes Balears → Islas Baleares; Comunitat Valenciana → Comunidad Valenciana.

update public.geo_ccaa set name = 'Andalucía' where code = '01';
update public.geo_ccaa set name = 'Aragón' where code = '02';
update public.geo_ccaa set name = 'Principado de Asturias' where code = '03';
update public.geo_ccaa set name = 'Islas Baleares' where code = '04';
update public.geo_ccaa set name = 'Canarias' where code = '05';
update public.geo_ccaa set name = 'Cantabria' where code = '06';
update public.geo_ccaa set name = 'Castilla y León' where code = '07';
update public.geo_ccaa set name = 'Castilla-La Mancha' where code = '08';
update public.geo_ccaa set name = 'Cataluña' where code = '09';
update public.geo_ccaa set name = 'Comunidad Valenciana' where code = '10';
update public.geo_ccaa set name = 'Extremadura' where code = '11';
update public.geo_ccaa set name = 'Galicia' where code = '12';
update public.geo_ccaa set name = 'Comunidad de Madrid' where code = '13';
update public.geo_ccaa set name = 'Región de Murcia' where code = '14';
update public.geo_ccaa set name = 'Comunidad Foral de Navarra' where code = '15';
update public.geo_ccaa set name = 'País Vasco' where code = '16';
update public.geo_ccaa set name = 'La Rioja' where code = '17';
update public.geo_ccaa set name = 'Ciudad Autónoma de Ceuta' where code = '18';
update public.geo_ccaa set name = 'Ciudad Autónoma de Melilla' where code = '19';

comment on column public.geo_ccaa.name is
  'Nombre en castellano (formato homogéneo para producto).';
