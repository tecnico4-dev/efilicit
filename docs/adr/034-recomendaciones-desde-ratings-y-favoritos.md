# 034 - Recomendaciones desde valoraciones, favoritos y perfil Eficen

**Fecha:** 2026-11-17

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Las notas (`tender_ratings`) y los favoritos (propios, comunes, peer) acumulan señal de interés, pero no alimentaban ninguna superficie de producto. Se quiere un bloque **Recomendadas** (home + página) con licitaciones en plazo que encajen de verdad, sin rellenar con un top-N flojo.

## Decisión

1. **Job batch** Python (`run-recommendations`) escribe `tender_recommendations` vía `EFILICIT_DATABASE_URL`. Workflow solo `workflow_dispatch` (ADR 005). Sin motor externo (FTS + `pg_trgm` + CPV en Postgres).
2. **Una lista por perfil** (`propia` | `subcontrata`), sin mezclar. Orden: gusto personal (★4–5 + favoritos propios) + boost del perfil empresa; candidatas con **encaje fuerte de empresa** también entran.
3. **Semillas**:
   - Personales: ratings ★4/★5 con `interest_kind`, favoritos propios del mismo `kind` (dedupe; favorito sin nota ≈ ★4).
   - Equipo / histórico (peso menor): `favorites_common`, `favorites_shared` del usuario, `offer_cases` (pipeline e histórico; `stage=subcontrata` → perfil subcontrata).
   - Negativas: ★1–2 del mismo kind. Se ignoran ★3 y ratings sin kind.
4. **Perfil empresa** (CPV/keywords de «quién es Eficen»): boost y puerta de entrada si el encaje es alto. Sin geo ni órgano.
5. **Umbral**, no cupo fijo: solo se guardan filas por encima de `SCORE_THRESHOLD`. Home muestra hasta 5 por perfil *si hay*; la página lista todas las que pasan el corte.
6. Tabla `tender_recommendations` RLS **select own**; escribe solo el job.
7. UI: motivo legible; «No me interesa» → ★1 con el kind del perfil.

## Alternativas

- Dos feeds (personal vs empresa). Descartado: todo es para Eficen; una sola cola.
- Top-N siempre. Descartado: rellena con poco interesantes.
- Embeddings / motor externo. Descartado: arquitectura fija; ADR nuevo si hace falta.

## Consecuencias

- Migración local + tipos; job dry-run/write; home + `/recommendations`.
- Recalcular en el siguiente lote tras valorar (no tiempo real).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Frío sin semillas personales | Entrada por perfil empresa + comunes / offer_cases |
| Histórico/común pesan demasiado | Pesos menores que ★/favoritos propios |
| CPV/keywords del doc sin validar | Solo boost; no filtro duro |

## Referencias

- [030](030-favorites-kind-eficen-subcontrata.md), [032](032-eficen-members-favorites-shared.md)
- [005](005-ingesta-actions-manual-first-cron-off.md), [004](004-ci-ingestion-sin-postgres.md)
