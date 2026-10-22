# 020 - `estimated_value` canónico sin IVA

**Fecha:** 22-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Las fuentes publican importes con bases fiscales distintas:

- PLACSP (CODICE): `cbc:TotalAmount` suele incluir IVA; `cbc:TaxExclusiveAmount` es la base sin IVA.
- Euskadi: `budgetWithoutVAT` (sin IVA).
- Catalunya SODA: `pressupost_licitacio_sense` (sin impuestos); `valor_estimat_contracte` / `valor_estimat_expedient` con semántica menos clara.

Hasta ahora el parser PLACSP prefería `TotalAmount` y Catalunya priorizaba `valor_estimat_contracte`. El resultado: filtros y alertas por importe mezclaban bases (con/sin IVA) entre fuentes y, tras la fuente ganadora ([ADR 015](015-fuente-ganadora-canonica.md)), el importe visible dependía de quién ganaba.

La UI y `criteria.estimated_value_*` usan una sola columna: `tenders.estimated_value`.

---

## Decisión

1. **Contrato canónico:** `tenders.estimated_value` = importe estimado / presupuesto base **sin IVA** (moneda en `currency`).
2. **Elección del campo en el conector**, no heurística en `normalize` (`/1.21`, etc.):
   - **PLACSP** (`placsp`, `placsp_agregadas`, `placsp_menores`): preferir `cac:BudgetAmount/cbc:TaxExclusiveAmount`; si falta, `cbc:TotalAmount` (mejor esfuerzo; puede quedar con IVA).
   - **Euskadi:** seguir con `budgetWithoutVAT`.
   - **Catalunya:** preferir `pressupost_licitacio_sense`; luego `valor_estimat_contracte`; luego `valor_estimat_expedient`. No mapear columnas «amb IVA» si aparecen.
3. Sin columnas nuevas (`amount_inc_vat`, etc.) en MVP.
4. Filas ya ingestadas: **re-ingesta** de la fuente propietaria (ADR 015); no backfill SQL a ciegas.

### Alternativas descartadas

- **B. Dos columnas (con/sin IVA):** más honesto, pero duplica UI/filtros/alertas y no hace falta para homogeneizar búsqueda.
- **C. Dividir TotalAmount por 1,21:** inventa tipo impositivo; incorrecto en exentos/reducidos.
- **D. Mezclar importes de fuentes secundarias:** contradice ADR 015.

---

## Consecuencias

- Parsers PLACSP y Catalunya cambian el valor emitido cuando existen ambos campos.
- Tests/fixtures alinean expectativas al neto; fixtures de solape PLACSP↔Euskadi usan el mismo neto.
- Comentario de columna en PostgreSQL documenta «sin IVA».
- Alertas/búsquedas guardadas con rangos calibrados a importes brutos PLACSP pueden dejar de matchear hasta reajustar criterios o re-ingestar.

---

## Riesgos

- Feeds PLACSP sin `TaxExclusiveAmount` siguen guardando `TotalAmount` (posible con IVA).
- `valor_estimat_*` de Catalunya puede no ser estrictamente sin IVA cuando no hay `pressupost_licitacio_sense`.

---

## Referencias

- [ADR 015](015-fuente-ganadora-canonica.md) — fuente ganadora sin mezcla de campos  
- `docs/sources/placsp.md`, `catalunya.md`, `euskadi.md`  
- Parsers: `connectors/placsp/parser.py`, `connectors/socrata/parser.py`, `connectors/euskadi/parser.py`
