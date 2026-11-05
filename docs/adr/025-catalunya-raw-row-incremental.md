# 025 - Catalunya RAW incremental por fila SODA (ventana SoQL)

**Fecha:** 2026-11-05

**Estado:** Aceptado

**Reemplaza:** Ninguno (extiende el patrón de [022](022-placsp-raw-entry-incremental.md) a `catalunya`)

**Reemplazado por:** Ninguno

---

## Contexto

Tras [022](022-placsp-raw-entry-incremental.md), PLACSP ya materializa RAW content-addressed por `atom:entry` y salta checksums conocidos. Catalunya seguía guardando **páginas SODA enteras** con `$order=:id` y una ventana fija de offsets: cada corrida diaria re-subía y re-procesaba miles de filas ya vistas, sin filtrar por novedad temporal.

El Open Data catalán (SODA) no ofrece un feed de deltas; sí permite SoQL `$where` / `$order`. Para vigilancia diaria hace falta:

1. Pedir solo candidatas recientes (ventana con solape).
2. No duplicar RAW ni re-canonizar filas cuyo contenido no cambió.

## Decisión

1. **Pull diario:** discover/fetch de páginas SODA con:
   - `$where=data_publicacio_anunci >= '<inicio ventana>'` (default **últimos 7 días**, medianoche Europe/Madrid; solape fijo, sin watermark);
   - `$order=data_publicacio_anunci DESC,:id DESC`;
   - `$limit` / `$offset` + `max_pages` como tope de seguridad dentro de la ventana.
2. **Storage:** **no** se sube la página JSON. Se materializa un objeto RAW por **fila** con `id_intern`:
   - `checksum` = SHA-256 del JSON canónico de la fila (`sort_keys`, UTF-8);
   - `artifact_key` = `rows/{checksum}.json`;
   - `source_url` = URL de la página SODA de origen.
3. **Dedup:** si `(catalunya, checksum)` ya existe en `source_artifacts` → no re-subir; **no** re-parsear ni re-upsert esa fila en esa corrida (mismo contrato que 022).
4. **Parse/upsert:** solo filas con checksum desconocido. Filas sin `id_intern` se omiten (igual que el parser actual).
5. **Euskadi** sin cambio en este ADR.

### Alternativas descartadas

- **Solo cambiar `$order` a fecha DESC + top-N.** Descartada: huecos si el volumen diario supera N o si el portal publica con retraso.
- **Watermark “desde última sync”.** Descartada en v1: más frágil ante fallos; la ventana fija de 7 días cubre solape con menos estado.
- **Seguir guardando la página entera.** Descartada: duplicación RAW y re-trabajo canónico en cada corrida.
- **No subir RAW.** Descartada por trazabilidad de producto.

## Consecuencias

### Positivas

- Corridas diarias acotadas al volumen reciente del portal.
- Storage y CPU tienden a “solo novedades/cambios de contenido”.
- Mismo patrón operativo que PLACSP (checksum → skip).

### Negativas / riesgos

- RAW antiguos de páginas Cat (pre-025) pueden quedar huérfanos; las corridas nuevas ya no los generan.
- Si en 7 días hay más filas que `max_pages × page_size`, hace falta subir el tope o ampliar la ventana (métrica: `records_seen` pegado al cupo).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Unique `(source_code, checksum)` | `artifact_key` derivado del checksum; lookup antes de insert |
| Fila sin `id_intern` | Se omite |
| Retraso de publicación Open Data | Ventana 7 días (configurable `--since-days`) |
| SoQL / zona horaria | Inicio de día Europe/Madrid documentado; ISO local en `$where` |

## Verificación

- Helper `expand_socrata_rows` + pipeline `catalunya_incremental`.
- Tests: 2ª corrida misma página → 0 uploads; fila tocada → 1 upload.
- ADR index + CHANGELOG + ficha `docs/sources/catalunya.md` + runbook cron.

## Referencias

- [022](022-placsp-raw-entry-incremental.md) · [006](006-raw-storage-httpx-sin-supabase-py.md)
- `ingestion/src/efilicit_ingestion/connectors/socrata/expand_rows.py`
- `ingestion/src/efilicit_ingestion/pipeline/catalunya_incremental.py`
- `docs/sources/catalunya.md`
