# 036 - Offer cases: kind propia/subcontrata e histórico en 3 estados

**Fecha:** 2026-11-23  
**Enmienda:** 2026-11-27 — se retira `en_evaluacion` (post-envío = `presentada`)

**Estado:** Aceptado

**Reemplaza:** Parcialmente [023](023-mis-licitaciones-pipeline-compartido.md) § etapas y [026](026-mis-licitaciones-offer-cases.md) §7 (stages). No se sobrescriben esos ADR; esta decisión los enmienda.

**Reemplazado por:** Ninguno

---

## Contexto

Mis licitaciones mezclaba **desenlace** y **modo de participación** en el mismo campo `stage`: `subcontrata` y `desierta` vivían en el histórico junto a adjudicada/no adjudicada/descartada. Eso hacía que un expediente cerrado se pareciera demasiado a uno activo (p. ej. riesgo de plazo) y no alineaba con favoritos/recomendaciones, donde `propia` | `subcontrata` es un eje ortogonal.

## Decisión

1. **`offer_cases.kind`** obligatorio: `propia` | `subcontrata` (mismo vocabulario que favoritos; UI «Eficen» / «Subcontrata»). Default `propia` si al crear no llega kind (p. ej. aún sin favorito).
2. **Stages activos:** `interes` | `analisis` | `preparacion` | `presentada` | `requerimiento`.  
   **Enmienda 2026-11-27:** se elimina `en_evaluacion`. Tras presentar la oferta el expediente queda en `presentada` (fecha en `presented_on`); no hay etapa intermedia hasta requerimiento o histórico. Filas `en_evaluacion` → `presentada`.
3. **Stages históricos** solo: `adjudicada` | `no_adjudicada` | `descartada`. Pasar a uno de estos mueve el expediente a Histórico.
4. **Retirados como stage:** `subcontrata` (pasa a `kind`) y `desierta` (estado canónico de la licitación si aplica; en expediente → `descartada` + motivo).
5. **Backfill:** filas existentes → `kind = propia`; las que estaban en `stage = subcontrata` → `kind = subcontrata` y `stage = adjudicada`.
6. UI histórico: sin KPI de riesgo de plazo; se muestra tipo (kind). Semillas de recomendaciones leen `offer_cases.kind`, no el stage.

## Alternativas

- Valor DB `eficen` en lugar de `propia`. Descartado: rompería el vocabulario compartido con favoritos/alertas/recomendaciones.
- Mantener `desierta` como stage. Descartado: no aporta al pipeline Eficen.
- Kind opcional. Descartado: producto quiere clasificación siempre.

## Consecuencias

- Migración `20261123120000_offer_cases_kind_and_historic_stages.sql` (local/Studio).
- Migración `20261127130000_drop_offer_stage_en_evaluacion.sql` (local/Studio).
- Kanban activo: columna única «Presentada» (sin «Evaluación»).
- Kanban histórico a 3 columnas; filtros de stage alineados.
- Job recomendaciones: perfil desde `kind`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Filas legacy mal clasificadas | Backfill explícito; dos subcontrata históricas → adjudicada + kind |
| Remoto | No aplicar hasta petición explícita del usuario |

## Referencias

- [023](023-mis-licitaciones-pipeline-compartido.md), [026](026-mis-licitaciones-offer-cases.md), [030](030-favorites-kind-eficen-subcontrata.md), [034](034-recomendaciones-desde-ratings-y-favoritos.md), [035](035-intake-pliegos-expediente.md)
