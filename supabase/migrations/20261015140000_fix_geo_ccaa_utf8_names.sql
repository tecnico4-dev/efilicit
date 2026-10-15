-- Corrige nombres de geo_ccaa si se aplicó la migración con encoding roto (tildes → ??).
-- Usa escapes Unicode (U&) para no depender del client_encoding del pipe.

update public.geo_ccaa set name = U&'Andaluc\00EDa' where code = '01';
update public.geo_ccaa set name = U&'Arag\00F3n' where code = '02';
update public.geo_ccaa set name = 'Principado de Asturias' where code = '03';
update public.geo_ccaa set name = 'Illes Balears' where code = '04';
update public.geo_ccaa set name = 'Canarias' where code = '05';
update public.geo_ccaa set name = 'Cantabria' where code = '06';
update public.geo_ccaa set name = U&'Castilla y Le\00F3n' where code = '07';
update public.geo_ccaa set name = 'Castilla-La Mancha' where code = '08';
update public.geo_ccaa set name = U&'Catalu\00F1a' where code = '09';
update public.geo_ccaa set name = 'Comunitat Valenciana' where code = '10';
update public.geo_ccaa set name = 'Extremadura' where code = '11';
update public.geo_ccaa set name = 'Galicia' where code = '12';
update public.geo_ccaa set name = 'Comunidad de Madrid' where code = '13';
update public.geo_ccaa set name = U&'Regi\00F3n de Murcia' where code = '14';
update public.geo_ccaa set name = 'Comunidad Foral de Navarra' where code = '15';
update public.geo_ccaa set name = U&'Pa\00EDs Vasco' where code = '16';
update public.geo_ccaa set name = 'La Rioja' where code = '17';
update public.geo_ccaa set name = U&'Ciudad Aut\00F3noma de Ceuta' where code = '18';
update public.geo_ccaa set name = U&'Ciudad Aut\00F3noma de Melilla' where code = '19';
