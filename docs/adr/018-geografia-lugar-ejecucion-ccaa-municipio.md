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

Las fuentes a menudo aportan **NUTS** (UE); el municipio INE es menos frecuente. Mezclar sede del organismo con lugar de obra confunde el producto.

---

## Decisión

1. **Catálogo aparte (solo lectura en app)**
   - `geo_ccaa` — código INE (`01`–`19`) + nombre; seed completo.
   - `geo_municipio` — código INE 5 dígitos + nombre + `ccaa_code` FK; carga en bloque vía `ingestion/data/geo_municipio.csv` + `scripts/seed_geo_municipio.py`.

2. **En `tenders` (lugar de ejecución, códigos nullable)**
   - `place_nuts_code` — primer NUTS si la fuente trae varios.
   - `place_ccaa_code` — FK a `geo_ccaa`; suele derivarse del NUTS-2.
   - `place_municipality_code` — FK a `geo_municipio` solo si el código existe en el catálogo; si no, `null` (no inventar).

3. **Sin provincia a corto plazo** — se puede derivar más adelante del INE/NUTS si hace falta.

4. **Criteria** — `geography.ccaa_codes` / `municipality_codes` (códigos). El texto legacy `municipalities` sobre sede del órgano no es lugar de ejecución.

5. **ETL** — `normalize` calcula `place_*` vía mapa NUTS→CCAA (y provincia→CCAA si hay municipio); el upsert persiste; municipio solo si está en `geo_municipio`.

6. **Fuentes (municipio)** — hoy solo Catalunya aporta código fiable (`codi_ine10` → 5 dígitos INE). PLACSP agregadas en la práctica solo trae NUTS en `RealizedLocation`. Euskadi no expone municipio de ejecución (solo sede/NUTS del órgano).

Migración: `20261015100000_geo_place_ccaa_municipio.sql`.

### Alternativas descartadas

- **Inferir CCAA solo por `source_code`.** Incorrecto para agregadas PLACSP.
- **Solo nombres libres en `tenders`.** Duplicados y filtros frágiles.
- **Tabla única mezclando CCAA y municipios.** Más lío que dos catálogos.
- **Provincia como filtro MVP.** Poco valor frente a CCAA + municipio.
- **Usar sede del organismo como lugar de obra por defecto.** Proxy engañoso; fuera del MVP.

---

## Consecuencias

- Filtros futuros de buscador/alertas sobre códigos estables.
- Muchas filas tendrán CCAA vía NUTS y municipio `null` si la fuente no aporta código INE.
- Tras seed de `geo_municipio`, Catalunya puede persistir `place_municipality_code`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| NUTS desactualizado / borde ESZZ | Mapa explícito; códigos desconocidos → CCAA null |
| FK municipio bloquea inserts | Solo escribir código si existe en catálogo |
| Confundir sede vs ejecución | Documentar; no fallback automático al órgano |

---

## Referencias

- `ingestion/src/efilicit_ingestion/pipeline/geography.py`
- `ingestion/src/efilicit_ingestion/pipeline/canonical.py`
- [packages/types/src/criteria.ts](../../packages/types/src/criteria.ts) — `geography.ccaa_codes`
- [ADR 015](015-fuente-ganadora-canonica.md) — fuente ≠ geografía
