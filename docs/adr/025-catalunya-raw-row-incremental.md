# 025 - CCAA RAW incremental por unidad (Catalunya + Euskadi)

**Fecha:** 2026-11-05

**Estado:** Aceptado

**Reemplaza:** Ninguno (extiende el patrón de [022](022-placsp-raw-entry-incremental.md) a las CCAA propias `catalunya` y `euskadi`)

**Reemplazado por:** Ninguno

---

## Contexto

Tras [022](022-placsp-raw-entry-incremental.md), PLACSP ya materializa RAW content-addressed por `atom:entry` y salta checksums conocidos. Catalunya y Euskadi seguían guardando **páginas enteras** (SODA / KontratazioA): cada corrida re-subía y re-procesaba avisos ya vistos.

Ninguna de las dos APIs ofrece un feed de deltas puro. Hace falta:

1. Acotar el pull diario (ventana o cabeza de listado).
2. No duplicar RAW ni re-canonizar unidades cuyo contenido no cambió.

## Decisión

Contrato común (mismo que 022 a nivel de Storage):

1. **Storage:** **no** se sube la página JSON. Se materializa un objeto RAW por **unidad** con identidad estable:
   - `checksum` = SHA-256 del JSON canónico (`sort_keys`, UTF-8);
   - `artifact_key` = `rows/{checksum}.json`;
   - `source_url` = URL de la página de origen.
2. **Dedup:** si `(source_code, checksum)` ya existe en `source_artifacts` → no re-subir; **no** re-parsear ni re-upsert en esa corrida.
3. **Parse/upsert:** solo unidades con checksum desconocido. Sin id estable → omitir.

### Pull por fuente

| Fuente | Unidad | Pull diario |
|---|---|---|
| `catalunya` | fila SODA (`id_intern`) | `$where=data_publicacio_anunci >= …` (default **7 días**, medianoche Europe/Madrid) + `$order=data_publicacio_anunci DESC,:id DESC` + paginación `$limit`/`$offset` / `max_pages` |
| `euskadi` | ítem KontratazioA (`id`) | Cabeza del listado: `start_page` + `max_pages` (`currentPage`; 10 ítems/página fijos en el conector actual). Sin filtro de fecha en v1 |

### Alternativas descartadas

- **Solo top-N por fecha en Catalunya sin `$where`.** Descartada: huecos si el volumen supera N o hay retraso de publicación.
- **Watermark “desde última sync”.** Descartada en v1: más frágil; Cat usa solape fijo de 7 días; Euskadi usa cabeza + checksum.
- **Seguir guardando la página entera.** Descartada: duplicación RAW y re-trabajo canónico.
- **No subir RAW.** Descartada por trazabilidad de producto.
- **Filtro SoQL/fecha en Euskadi en este ADR.** Aplazado hasta validar parámetros oficiales de la API; el skip por checksum ya evita hinchar Storage.

## Consecuencias

### Positivas

- Corridas diarias acotadas (ventana Cat / cabeza Euskadi).
- Storage y CPU tienden a “solo novedades/cambios de contenido”.
- Mismo patrón operativo que PLACSP (checksum → skip) en las tres familias de fuente del MVP.

### Negativas / riesgos

- RAW antiguos de páginas Cat/Euskadi (pre-025) pueden quedar huérfanos; las corridas nuevas ya no los generan.
- Cat: si en 7 días hay más filas que `max_pages × page_size`, subir tope o ventana.
- Euskadi: si un día hay más novedades que `max_pages × 10` en la cabeza del listado, ampliar `max_pages`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Unique `(source_code, checksum)` | `artifact_key` derivado del checksum; lookup antes de insert |
| Sin `id_intern` / sin `id` | Se omite |
| Retraso Open Data Cat | Ventana 7 días (`--since-days`) |
| SoQL / zona horaria Cat | Inicio de día Europe/Madrid; ISO local en `$where` |
| API Euskadi sin filtro fecha | Cabeza `max_pages` + checksum |

## Verificación

- Helpers `expand_socrata_rows` / `expand_euskadi_items` + pipelines `catalunya_incremental` / `euskadi_incremental`.
- Tests: 2ª corrida misma página → 0 uploads; unidad tocada → 1 upload.
- ADR index + CHANGELOG + fichas `docs/sources/catalunya.md` / `euskadi.md` + runbook cron.

## Referencias

- [022](022-placsp-raw-entry-incremental.md) · [006](006-raw-storage-httpx-sin-supabase-py.md)
- `ingestion/src/efilicit_ingestion/connectors/socrata/expand_rows.py`
- `ingestion/src/efilicit_ingestion/connectors/euskadi/expand_items.py`
- `ingestion/src/efilicit_ingestion/pipeline/catalunya_incremental.py`
- `ingestion/src/efilicit_ingestion/pipeline/euskadi_incremental.py`
- `docs/sources/catalunya.md` · `docs/sources/euskadi.md`
