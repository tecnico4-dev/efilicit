-- Reescribe bodies antiguos "Intake PLACSP: …" al copy legible de extraccion_anuncio.
create or replace function public._rewrite_intake_log_body(old_body text)
returns text
language plpgsql
immutable
as $$
declare
  m text[];
  pliegos int := 0;
  requirements int := 0;
  deliverables int := 0;
  milestones int := 0;
  downloaded int := 0;
  failed int := 0;
  loaded text[] := array[]::text[];
  text_out text;
begin
  if old_body is null or old_body not like 'Intake PLACSP:%' then
    return old_body;
  end if;

  m := regexp_match(
    old_body,
    'Intake PLACSP: (\d+) pliegos?, (\d+) requisitos?, (\d+) sobres/entregables, (\d+) hitos?\.'
  );
  if m is null then
    return old_body;
  end if;

  pliegos := m[1]::int;
  requirements := m[2]::int;
  deliverables := m[3]::int;
  milestones := m[4]::int;

  m := regexp_match(
    old_body,
    'Descargados (\d+) documentos? \((\d+) con error\)\.'
  );
  if m is not null then
    downloaded := m[1]::int;
    failed := m[2]::int;
  end if;

  if pliegos > 0 then
    loaded := loaded || format(
      '%s pliego%s', pliegos, case when pliegos = 1 then '' else 's' end
    );
  end if;
  if requirements > 0 then
    loaded := loaded || format(
      '%s requisito%s', requirements, case when requirements = 1 then '' else 's' end
    );
  end if;
  if deliverables > 0 then
    loaded := loaded || format(
      '%s criterio%s en sobres',
      deliverables,
      case when deliverables = 1 then '' else 's' end
    );
  end if;
  if milestones > 0 then
    loaded := loaded || format(
      '%s plazo%s', milestones, case when milestones = 1 then '' else 's' end
    );
  end if;

  if cardinality(loaded) > 0 then
    text_out :=
      'Se han cargado datos del anuncio de la Plataforma: '
      || array_to_string(loaded, ', ')
      || '.';
  else
    text_out :=
      'Se ha vuelto a consultar el anuncio. No había datos nuevos que añadir.';
  end if;

  if downloaded > 0 or failed > 0 then
    if downloaded > 0 and failed = 0 then
      text_out := text_out || format(
        ' Se ha%s descargado %s documento%s.',
        case when downloaded = 1 then '' else 'n' end,
        downloaded,
        case when downloaded = 1 then '' else 's' end
      );
    elsif downloaded > 0 and failed > 0 then
      text_out := text_out || format(
        ' Se ha%s descargado %s documento%s; %s no se pudo%s descargar.',
        case when downloaded = 1 then '' else 'n' end,
        downloaded,
        case when downloaded = 1 then '' else 's' end,
        failed,
        case when failed = 1 then '' else 'ieron' end
      );
    else
      text_out := text_out || format(
        ' No se pudo%s descargar %s documento%s.',
        case when failed = 1 then '' else 'ieron' end,
        failed,
        case when failed = 1 then '' else 's' end
      );
    end if;
  elsif cardinality(loaded) = 0 then
    text_out :=
      'Se ha consultado el anuncio; no había cambios ni documentos pendientes de descarga.';
  end if;

  return text_out;
end;
$$;

update public.offer_case_log
set body = public._rewrite_intake_log_body(body)
where body like 'Intake PLACSP:%';

drop function public._rewrite_intake_log_body(text);
