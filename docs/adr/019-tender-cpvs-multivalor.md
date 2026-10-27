# 019 - CPV multivalor en `tender_cpvs` (sin columna en `tenders`)

**Fecha:** 20-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Las fuentes (p. ej. PLACSP) pueden publicar **varios** códigos CPV por expediente. El modelo canónico solo guardaba `tenders.cpv_code` (el primero vía `_primary_cpv`), descartando el resto. La búsqueda y las alertas solo veían ese código.

No hay evidencia de que el orden en la fuente implique relevancia; tratar un CPV como “principal” era una mentira del modelo.

---

## Decisión

1. Tabla hija `public.tender_cpvs (tender_id, cpv_code)` con PK compuesta; FK a `tenders` ON DELETE CASCADE.
2. **Eliminar** `tenders.cpv_code`. Sin `is_primary` ni orden de importancia.
3. Sin filas en `tender_cpvs` = licitación sin CPV.
4. Búsqueda (`search_tenders`) y alertas: coincidencia por **prefijo** (`LIKE` / `startswith`) sobre el conjunto del tender.
5. Modo de combinación de varios criterios CPV (`criteria.cpv_match` / `p_cpv_match`):
   - **`any` (default):** basta que **algún** CPV del tender cumpla **algún** prefijo (OR × OR).
   - **`all`:** **cada** prefijo de criterio debe cumplirse con **algún** CPV del tender (AND de prefijos).
   - Criterios/búsquedas guardadas sin el campo → `any` (compatibilidad).
6. Matching multi-fuente: señal positiva si la **intersección** de conjuntos CPV no es vacía.
7. Fuente ganadora (ADR 015): al crear/actualizar/promover la fila canónica, **sustituir el conjunto** de `tender_cpvs` por los CPV de esa fuente (no mezcla parcial).
8. RLS como el resto del canónico (ADR 003): SELECT público; escritura solo ETL / `service_role`.

### Alternativas descartadas

- **B. Tabla + mantener `tenders.cpv_code` denormalizado:** obliga a elegir un “principal” y duplica dato.
- **C. Array/`GENERATED` en `tenders`:** lectura cómoda, pero menos flexible para índices/joins y sigue empujando a un único campo de display privilegiado.

---

## Consecuencias

- Pipeline emite `canonical.cpv_codes: list[str]` y sincroniza `tender_cpvs`.
- RPC `search_tenders` devuelve `cpv_codes text[]` y acepta `p_cpv_match`.
- UI (picker CPV) y alertas/búsquedas guardadas exponen `cpv_match` cuando hay ≥2 códigos.
- Backfill desde la columna antigua recupera solo el CPV que ya estaba; secundarios requieren re-ingesta.

---

## Riesgos

- Más joins en listados/ficha si no se agrega en la RPC.
- Matching por intersección puede subir recall (calibrar si aparecen falsos positivos).
- Histórico sin secundarios hasta re-procesar fuentes.
- Modo `all` con prefijos muy anchos puede seguir siendo laxo; copy de UI debe dejar claro el semántica de prefijo.

---

## Referencias

- [ADR 003](003-acceso-canonico-publico-etl-privado.md) — RLS canónico
- [ADR 011](011-busqueda-via-rpc-search-tenders.md) — `search_tenders`
- [ADR 015](015-fuente-ganadora-canonica.md) — fuente ganadora / fila entera
