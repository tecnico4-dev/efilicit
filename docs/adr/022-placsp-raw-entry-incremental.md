# 022 - PLACSP RAW incremental por entry Atom (sin ZIP entero en Storage)

**Fecha:** 2026-10-29

**Estado:** Aceptado

**Reemplaza:** Ninguno (complementa [006](006-raw-storage-httpx-sin-supabase-py.md) / [021](021-raw-storage-tus-resumable-httpx.md) en el contrato de *qué* se materializa como RAW para PLACSP)

**Reemplazado por:** Ninguno

---

## Contexto

Los ZIPs mensuales PLACSP (perfiles / agregadas / menores) son grandes y **crecen dentro del mes**. Re-subir el ZIP entero cada lunes:

- choca el techo Free de Storage (~50 MB/archivo) (`EntityTooLarge`);
- duplica en `raw/` casi el mismo contenido semana a semana;
- alarga corridas (menores llegó a 6 h en Actions).

El producto sigue necesitando **trazabilidad** de cada licitación a bytes de origen. No exige conservar el ZIP oficial completo en Storage.

## Decisión

1. **Descarga:** se sigue bajando el ZIP mensual oficial (Hacienda no publica trozos semanales).
2. **Storage:** **no** se sube el ZIP entero. Se materializa un objeto RAW por **`atom:entry`** (documento Atom mínimo), content-addressed:
   - `checksum` = SHA-256 del payload guardado;
   - `artifact_key` = `entries/{checksum}.atom.xml`;
   - `source_url` = URL del ZIP mensual de origen.
3. **Dedup:** si `(source_code, checksum)` ya existe en `source_artifacts` → no re-subir; **no** re-parsear ni re-upsert esa entry en esa corrida (v1).
4. **Parse/upsert:** solo entries **nuevas** (checksum desconocido). Varias versiones del mismo expediente en el lote nuevo → se conserva la de `atom:updated` más reciente (misma regla que el parser ZIP).
5. Aplica a las tres sindicaciones PLACSP; Catalunya/Euskadi sin cambio.

### Alternativas descartadas

- **Seguir guardando el ZIP entero.** Descartada: 413 / duplicación / tiempo.
- **Trocear por semanas en URL Hacienda.** Descartada: no existe el paquete.
- **RAW por fichero `.atom` del ZIP.** Descartada: suele ser un Atom enorme (&gt;50 MB).
- **No subir RAW.** Descartada por producto.

## Consecuencias

### Positivas

- Entries caben bajo 50 MB; Free viable.
- Semanas siguientes solo suben/procesan novedades/cambios.
- Provenance por licitación vía `artifact_id` → `source_artifacts.storage_path`.

### Negativas / riesgos

- Ya no hay en Storage una copia bit-a-bit del ZIP oficial del día D (sí la URL + entries).
- Expand+hash de todas las entries sigue costando CPU en ZIPs enormes; si Actions sigue a 6 h, paralelizar por lotes (futuro).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Unique `(source_code, checksum)` | `artifact_key` derivado del checksum; lookup antes de insert |
| Entry sin identidad estable | Se omite (igual que el parser actual) |
| Replay “ZIP exacto” | No soportado; replay = re-fetch ZIP oficial + expand |

## Verificación

- Helper `expand_placsp_entries` + pipeline PLACSP incremental.
- Tests: segunda corrida mismo ZIP → 0 uploads; entry nueva → 1 upload.
- ADR index + CHANGELOG + fichas `docs/sources/placsp*.md`.

## Referencias

- [006](006-raw-storage-httpx-sin-supabase-py.md) · [021](021-raw-storage-tus-resumable-httpx.md)
- `ingestion/src/efilicit_ingestion/connectors/placsp/expand_entries.py`
- `ingestion/src/efilicit_ingestion/pipeline/placsp_incremental.py`
- `docs/sources/placsp.md` · `placsp_agregadas.md` · `placsp_menores.md`
