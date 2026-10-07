# 015 - Fuente ganadora canónica (ranking fijo, sin mezcla de campos)

**Fecha:** 07-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Tras un `auto` match multi-fuente, el upsert reescribía `public.tenders` con los campos de la fuente entrante (last-writer-wins). Una fuente más pobre (p. ej. Euskadi sin CPV/plazo) podía pisar con `NULL` datos ya buenos; además, un falso `auto` mezclaba campos de dos contratos distintos en una sola fila.

Alternativa “COALESCE campo a campo” (rellenar huecos) también mezclaría procedencias y encarecía el fallo de matching.

---

## Decisión

1. **`tenders` es copia de una sola fuente dueña** (`canonical_source_code`). Las demás fuentes solo enlazan en `tender_sources`.
2. **Ranking fijo** (menor número = más prioridad):

   | Prioridad | `source_code` |
   |---|---|
   | 10 | `placsp` |
   | 20 | `placsp_agregadas` |
   | 30 | `placsp_menores` |
   | 40 | `catalunya` |
   | 50 | `euskadi` |
   | 1000 | cualquier otro (desconocido) |

3. **Creación:** la fuente que crea el tender es la dueña.
4. **Auto / re-ingesta de secundaria con menor prioridad:** solo `tender_sources` (+ `last_seen_at`); **no** `_update_tender`.
5. **Promoción:** si llega (o re-ingesta) una fuente con **mayor** prioridad que la dueña actual → sustituir **entera** la fila `tenders` con los datos de la nueva dueña y actualizar `canonical_source_code` (sin mezcla campo a campo).
6. **Re-ingesta de la dueña:** sí actualiza `tenders` si cambian campos de negocio (comportamiento previo de contenido).

Solape esperado: CCAA propia ↔ `placsp_agregadas` (y familia PLACSP). Catalunya ↔ Euskadi casi no se pisan; el orden entre ellas es indiferente en la práctica.

Migración: `supabase/migrations/20261007100000_tenders_canonical_source_code.sql`.

### Alternativas descartadas

- **COALESCE / merge por campo.** Mezcla procedencias; fallo de `auto` más opaco.
- **“Más campos rellenos” por licitación.** Menos predecible; no evita el riesgo de falso `auto`.
- **Quien llega primero siempre.** Si entra Euskadi antes que PLACSP, la ficha se queda pobre para siempre.

---

## Consecuencias

- Ficha canónica trazable a una fuente; enlaces multi-fuente siguen en `tender_sources`.
- Fallo de `auto` menos destructivo (no frankenstein de campos).
- Si la dueña es pobre y una fuente mejor aún no ha ganado/promovido, la ficha puede quedar incompleta a propósito.
- Nuevas fuentes → ampliar la tabla de prioridades (y este ADR o uno que lo reemplace).

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Ranking desactualizado al añadir TED/CCAA | Revisar ADR + lista en código al integrar fuente |
| Promoción pisa cambios locales de la dueña anterior | Intencional: gana la fuente de mayor prioridad |
| Filas legacy sin dueña | Backfill desde el `tender_sources` más antiguo |

---

## Referencias

- `ingestion/src/efilicit_ingestion/pipeline/canonical_repo.py` (`SOURCE_PRIORITY`, upsert)
- `docs/sources/cobertura-ccaa.md` (solape agregadas ↔ Cat/Euskadi)
- Matching Semana 4 / `docs/04-roadmap-mvp.md` § deduplicación
