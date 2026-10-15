# 018 - Geografía de lugar de ejecución: CCAA + municipio (sin provincia)

**Fecha:** 15-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El buscador y las alertas necesitan filtrar por territorio (p. ej. “solo Andalucía” o un municipio). Eso **no** se puede inferir solo de `source_code`:

- `placsp_agregadas` es un **canal** multi-CCAA, no una comunidad;
- `euskadi` / `catalunya` sugieren ámbito pero el dato fiable es el lugar de ejecución del aviso.

Las fuentes a menudo aportan **NUTS** (UE); el municipio INE es menos frecuente. Mezclar sede del organismo con lugar de obra confunde el producto. En Euskadi (y a veces en otras fuentes) el municipio aparece en el **título** (`… de Leioa`, `… (Durango)`) sin código INE en la API.

---

## Decisión

1. **Catálogo aparte (solo lectura en app)**
   - `geo_ccaa` — código INE (`01`–`19`) + nombre; seed completo.
   - `geo_municipio` — código INE 5 dígitos + nombre + `ccaa_code` FK; carga en bloque vía `ingestion/data/geo_municipio.csv` + `scripts/seed_geo_municipio.py` (~8k filas; **no** se deriva de `tenders`).

2. **En `tenders` (lugar de ejecución, códigos nullable)**
   - `place_nuts_code` — primer NUTS si la fuente trae varios.
   - `place_ccaa_code` — FK a `geo_ccaa`; suele derivarse del NUTS-2 (o de la provincia del municipio).
   - `place_municipality_code` — FK a `geo_municipio` solo si el código existe en el catálogo; si no, `null`.

3. **Sin provincia a corto plazo** — se puede derivar más adelante del INE/NUTS si hace falta.

4. **Criteria / buscador** — `geography.ccaa_codes` → RPC `search_tenders.p_ccaa_codes` sobre `tenders.place_ccaa_code`. `municipality_codes` para filtros futuros por municipio. El texto legacy `municipalities` (sede del órgano) no es lugar de ejecución.

5. **ETL — resolución de `place_*`**
   1. Código INE de fuente si existe (p. ej. Catalunya `codi_ine10` → 5 dígitos).
   2. Si **no** hay municipio y **sí** hay CCAA: inferencia desde el **título**, solo contra municipios de esa CCAA:
      - `(Municipio)` en paréntesis; o
      - partícula `de` / `del` / `de la` / `de los` / `de las` + nombre.
      - Prioridad: **paréntesis > partícula `de…`**; dentro de cada clase, el nombre de catálogo **más largo**.
      - Sin alias bilingües libres por ahora (sí se aceptan variantes estructurales del nombre INE: artículo final `…, El` y lados de `/` en nombres oficiales).
   3. Upsert: municipio solo si está en `geo_municipio` (FK).

6. **Fuentes**
   - Catalunya: suele traer `codi_ine10` (prioridad sobre inferencia).
   - PLACSP agregadas: en la práctica solo NUTS en `RealizedLocation`; municipio vía título si aplica.
   - Euskadi: NUTS del órgano → CCAA; municipio vía inferencia de título cuando encaja.

Migraciones: `20261015100000_geo_place_ccaa_municipio.sql`, `20261015120000_search_tenders_ccaa_codes.sql`.

### Alternativas descartadas

- **Inferir CCAA solo por `source_code`.** Incorrecto para agregadas PLACSP.
- **Solo nombres libres en `tenders`.** Duplicados y filtros frágiles.
- **Tabla única mezclando CCAA y municipios.** Más lío que dos catálogos.
- **Provincia como filtro MVP.** Poco valor frente a CCAA + municipio.
- **Usar sede del organismo como lugar de obra por defecto.** Proxy engañoso.
- **Match libre del nombre en cualquier posición del título.** Demasiados falsos positivos; se acota a `de…` / `(…)`.
- **Inferir municipio sin CCAA conocida.** Ambigüedad entre homónimos; fuera de alcance.

---

## Consecuencias

- El buscador puede filtrar por CCAA (`place_ccaa_code`); la ficha muestra CCAA y municipio (join al catálogo).
- Muchas filas tendrán CCAA vía NUTS; el municipio llegará por INE de fuente o por inferencia de título (con riesgo residual de falso positivo).
- El catálogo `geo_municipio` es completo a propósito: habrá municipios sin ningún tender.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| NUTS desactualizado / borde ESZZ | Mapa explícito; códigos desconocidos → CCAA null |
| FK municipio bloquea inserts | Solo escribir código si existe en catálogo |
| Confundir sede vs ejecución | No fallback automático al órgano; título solo con patrones acotados |
| Falso positivo en título | Solo CCAA conocida; paréntesis/`de…`; nombre más largo; sin alias libres |
| Homónimos entre CCAA | Inferencia acotada al catálogo de esa CCAA |

---

## Referencias

- `ingestion/src/efilicit_ingestion/pipeline/geography.py`
- `ingestion/src/efilicit_ingestion/pipeline/canonical.py`
- [packages/types/src/criteria.ts](../../packages/types/src/criteria.ts) — `geography.ccaa_codes`
- [ADR 015](015-fuente-ganadora-canonica.md) — fuente ≠ geografía
