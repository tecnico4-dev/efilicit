# 008 - `placsp_menores` aplazado de Semana 3 a Semana 4+

**Fecha:** 18-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

En el inventario de Semana 3 (Paso 1) el orden estatal previsto era:

1. `placsp_agregadas` (`sindicacion_1044`) — máxima cobertura territorial con reuso Atom/CODICE,
2. `placsp_menores` (`sindicacion_1143`) — pedido en el corte MVP.

El criterio de salida de Semana 3 pedía fuentes estatales priorizadas ingiriendo **y** varias CCAA propias con datos reales. Con el tiempo de la semana, completar agregadas + Catalunya + Euskadi (incluidas verificaciones live) absorbía el foco; meter menores en el mismo cierre diluía el hito de “primeras CCAA” sin aportar un patrón nuevo (es el mismo reuso PLACSP que agregadas).

---

## Decisión

**Aplazar** la implementación E2E de `placsp_menores` a **Semana 4+** (leftover explícito del plan Semana 4 / Paso 2).

Semana 3 cierra con:

- estatal priorizado entregado: **`placsp_agregadas`** (live + idempotencia);
- CCAA propias: **`catalunya`** + **`euskadi`**;
- `placsp_menores` documentado en inventario / catálogo como siguiente reuso PLACSP, no como pendiente “olvidada”.

### Alternativas descartadas

- **Implementar menores antes que la segunda CCAA.** Descartada: el criterio de salida enfatiza varias CCAA propias; menores no aporta adaptador nuevo.
- **Marcar menores como N/A del MVP.** Descartada: sigue en el corte MVP; solo se mueve de semana.
- **Hacer un half-slice de menores sin live/CLI/workflow.** Descartada: rompe el estándar “fuente añadida = ficha + tests + sync + job controlado”.

---

## Consecuencias

### Positivas

- Semana 3 cierra con cobertura autonómica demostrable y reuso PLACSP ya probado en agregadas.
- Menores entra en Semana 4 con el mismo patrón (`PlacspSyndication` / `run-placsp --syndication`).

### Negativas / riesgos

- Hasta Semana 4 el MVP no ingiere contratos menores por canal dedicado.
- Hay que evitar que el aplazamiento se lea como “menores fuera del producto”; el ADR y el plan Semana 4 lo mantienen en alcance.

---

## Verificación

- `docs/plans/fase3-checklist.md`: criterio estatal OK vía `placsp_agregadas`; menores → Semana 4+.
- `docs/plans/semana03-plan.md` / `semana04-plan.md`: leftover `placsp_menores`.
- Tras Semana 4: conector/CLI/workflow para `placsp_menores` presentes (fuera del alcance de este ADR).

---

## Referencias

- `docs/04-roadmap-mvp.md` § Semana 3 y §1 (corte MVP)
- `docs/plans/semana03-plan.md` · `docs/plans/fase3-checklist.md`
- `docs/plans/semana04-plan.md`
- `docs/sources/placsp_menores.md` (ficha; implementación E2E posterior)
