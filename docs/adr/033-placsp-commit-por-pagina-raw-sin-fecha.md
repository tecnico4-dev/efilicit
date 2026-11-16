# 033 - PLACSP commit por página Atom + RAW path sin fecha

**Fecha:** 2026-11-16

**Estado:** Aceptado

**Reemplaza:** Ninguno (extiende [022](022-placsp-raw-entry-incremental.md) / [025](025-catalunya-raw-row-incremental.md) en *cuándo* se confirma BD y *dónde* se guarda el objeto)

**Reemplazado por:** Ninguno

---

## Contexto

Con ADR 022 el RAW sigue siendo **una entry = un fichero**, pero el pipeline PLACSP hacía **un solo `commit` al final del ZIP mensual**. Un fallo a mitad:

- hacía rollback de todo lo canónico del mes;
- dejaba en Storage objetos ya subidos (huérfanos);
- y, al reintentar otro día, la convención `raw/{source}/{yyyy}/{mm}/{dd}/{artifact_key}` generaba **otra ruta** para el mismo checksum → más basura.

El timeout de Actions (tope 6 h) no es el problema prioritario; sí lo es perder progreso y multiplicar huérfanos.

## Decisión

1. **Unidad de commit PLACSP:** cada fichero `.atom` dentro del ZIP mensual (página Atom, típicamente hasta ~500 entries). Tras procesar una página → `conn.commit()` (hook `on_page_committed`). RAW **sigue** entry-level (`entries/{sha256}.atom.xml`); no se adopta página gzip (P3).
2. **Ruta Storage content-addressed (todas las fuentes vía `paths.py`):**
   - `raw/{source_code}/entries/{sha256}.atom.xml` (PLACSP)
   - `raw/{source_code}/rows/{sha256}.json` (Catalunya / Euskadi)
   - Sin carpeta de día de subida. Reintento = misma clave + `x-upsert`.
3. **Objetos legacy** con `AAAA/MM/DD` en la ruta: se dejan; `source_artifacts.storage_path` sigue siendo la fuente de verdad. Huérfanos viejos → cleanup existente. No hace falta migrar bytes para que el skip por checksum funcione.
4. **Timeout Actions:** sin cambio (sigue el default ~6 h).

### Alternativas descartadas

- **Commit por entry.** Demasiados round-trips SQL/Storage en un ZIP grande.
- **RAW por página Atom gzip (P3).** Más ahorro de objetos; aplazado; cambia el modelo de provenance por entry.
- **Mantener fecha en el path “para listar por corrida”.** El listado por día no compensa la duplicación en reintentos; la corrida vive en `sync_runs`.

## Consecuencias

### Positivas

- Fallo a mitad de mes: se conserva lo ya confirmado; la siguiente corrida salta checksums conocidos.
- Menos huérfanos nuevos por path distinto el día siguiente.
- Cat/Euskadi heredan el path sin fecha en la próxima subida (mismo helper).

### Negativas / riesgos

- Coexisten temporalmente layouts con y sin fecha en el bucket hasta purge/cleanup.
- Expand+hash de todo el ZIP sigue costando CPU antes/durante el recorrido por páginas.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Hook `on_page_committed` olvida el commit final de `finish_run` | Wrapper Postgres hace `commit` tras éxito además del hook por página |
| Fallo dentro de una página | Rollback solo de esa página; páginas anteriores ya committed |
| Tests / docs con paths fechados | Actualizados; purge sigue aceptando paths legacy |

## Verificación

- `expand_placsp_pages` + pipeline con `on_page_committed`.
- Tests: ZIP 2×`.atom` → 2 callbacks; path sin `/yyyy/mm/dd/`; fallo tras 1ª página deja materializado lo previo en memoria.
- ADR index + CHANGELOG + fichas `docs/sources/placsp*.md` / catalunya / euskadi.

## Referencias

- [022](022-placsp-raw-entry-incremental.md) · [025](025-catalunya-raw-row-incremental.md) · [006](006-raw-storage-httpx-sin-supabase-py.md)
- `ingestion/src/efilicit_ingestion/pipeline/paths.py`
- `ingestion/src/efilicit_ingestion/pipeline/placsp_incremental.py`
- `ingestion/src/efilicit_ingestion/connectors/placsp/expand_entries.py`
