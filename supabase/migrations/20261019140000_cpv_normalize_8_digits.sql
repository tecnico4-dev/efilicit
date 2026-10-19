-- Normaliza cpv_code a 8 dígitos (ceros a la derecha) + control opcional -X.
-- Alinea filas ya guardadas con normalize_cpv_code del pipeline.

-- 1) Forma «base-check»: normalizar base a 8 dígitos y conservar el control.
update public.tenders
set cpv_code = rpad(regexp_replace(split_part(cpv_code, '-', 1), '\D', '', 'g'), 8, '0')
  || '-'
  || regexp_replace(split_part(cpv_code, '-', 2), '\D', '', 'g')
where cpv_code like '%-%'
  and regexp_replace(split_part(cpv_code, '-', 1), '\D', '', 'g') <> ''
  and regexp_replace(split_part(cpv_code, '-', 2), '\D', '', 'g') <> '';

-- 2) Solo dígitos (u otros no-dígitos sin guion): extraer dígitos y rellenar a 8.
update public.tenders
set cpv_code = rpad(left(regexp_replace(cpv_code, '\D', '', 'g'), 8), 8, '0')
where cpv_code is not null
  and cpv_code not like '%-%'
  and regexp_replace(cpv_code, '\D', '', 'g') <> '';

-- 3) Basura sin dígitos → null.
update public.tenders
set cpv_code = null
where cpv_code is not null
  and regexp_replace(cpv_code, '\D', '', 'g') = '';

comment on column public.tenders.cpv_code is
  'CPV principal: 8 dígitos (jerarquía, ceros a la derecha) y opcionalmente «-» + dígito(s) de control.';
