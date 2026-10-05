# 009 - CCAA propia extra: N/A en Semana 4

**Fecha:** 17-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El plan de Semana 4 (`docs/plans/semana04-plan.md`) deja abierta, en el Paso 3, la posibilidad de implementar **una** CCAA propia extra (ficha → conector → RAW → upsert → CLI → workflow → tests), además de Catalunya y Euskadi ya integradas en Semana 3.

El criterio de salida del roadmap para Semana 4 define cobertura territorial como **ruta de fuente identificada** por comunidad (conector propio, agregación `placsp_agregadas` o perfiles alojados `placsp`), no como “17 conectores nuevos”.

Tras el inventario (Paso 1):

- 2 CCAA con conector propio (Catalunya, País Vasco),
- 5 vía agregación PLACSP,
- 10 vía perfiles alojados PLACSP,

las 17 CCAA ya tenían ruta documentada. Meter un tercer conector autonómico en la misma semana competía con el leftover estatal `placsp_menores` ([ADR 008](008-placsp-menores-aplazado-semana4.md)) y con la deduplicación multi-fuente (Pasos 4–7), que sí aportaban contrato nuevo.

---

## Decisión

En Semana 4 la CCAA propia extra se marca **N/A** (0 conectores autonómicos nuevos):

- Cobertura MVP = matriz en `docs/sources/cobertura-ccaa.md` (rutas identificadas).
- Orden de ataque: `placsp_menores` → matching / upsert / fixtures de solape.
- Open Data / CSV autonómicos y menores de plataformas agregadas quedan en **backlog**, no como olvido del checklist.

### Alternativas descartadas

- **Implementar una CCAA propia extra (p. ej. Galicia/Madrid nativa) antes que dedup.** Descartada: peor retorno frente a `placsp_menores` + matching, que cierran el corte MVP de Semana 4.
- **Forzar un conector por CCAA “para llegar a 17”.** Descartada: contradice el criterio de salida del roadmap y la arquitectura de reutilizar canales PLACSP cuando bastan.
- **Marcar cobertura N/A sin documentar rutas.** Descartada: el inventario en `docs/sources/` es el entregable de cobertura.

---

## Consecuencias

### Positivas

- Semana 4 cierra cobertura 17 CCAA + menores + dedup sin diluir el foco.
- Queda explícito que el N/A del Paso 3.2 no es un conector “olvidado”.

### Negativas / riesgos

- CCAA con Open Data propio útil siguen sin conector dedicado hasta priorizarlas.
- Alguien puede reinterpretar Semana 4 como “faltó la tercera CCAA”; este ADR lo cierra.

---

## Verificación

- `docs/plans/fase4-checklist.md`: Paso 3.2 = N/A; Paso 1 OK con 0 CCAA extra.
- `docs/plans/semana04-plan.md`: decisión Paso 1 = CCAA propia extra **0 (N/A)**.
- `docs/sources/cobertura-ccaa.md`: matriz 17 CCAA + conteo “0 conectores nuevos Semana 4”.

---

## Referencias

- `docs/04-roadmap-mvp.md` § Semana 4 y §1 (definición de cobertura)
- `docs/plans/semana04-plan.md` · `docs/plans/fase4-checklist.md`
- `docs/sources/cobertura-ccaa.md`
- [ADR 008](008-placsp-menores-aplazado-semana4.md) (`placsp_menores` en Semana 4)
