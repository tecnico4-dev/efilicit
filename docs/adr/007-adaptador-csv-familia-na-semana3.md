# 007 - Adaptador CSV de familia: N/A en Semana 3

**Fecha:** 18-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El roadmap de Semana 3 (`docs/04-roadmap-mvp.md`) incluye, como tarea condicional:

> Implementar el primer adaptador CSV genérico **si** existe una familia de fuentes realmente compatible.

En el inventario de Semana 3 (Paso 1) la cola de CCAA priorizó:

1. Catalunya (Socrata / SODA),
2. Euskadi (REST KontratazioA),

y dejó varias reservas CSV (`valencia`, `jcyl`, `canarias`, …) solo para sustituir si un objetivo se bloqueaba.

No había, en ese momento, una **familia CSV transversal** con compatibilidad técnica y semántica suficiente para justificar un adaptador genérico “por si acaso”. Forzarlo habría sido abstracción prematura (contra la regla de reutilizar solo con compatibilidad real).

---

## Decisión

En Semana 3 el adaptador CSV de **familia** se marca **N/A**:

- No se implementa un conector CSV genérico reutilizable.
- Si en el futuro una reserva CSV entra en la cola por bloqueo (o en Semana 4+), se implementa primero el **conector puntual** de esa fuente y solo entonces se valora factorizar un adaptador CSV de familia.
- Catalunya y Euskadi se atacan con sus APIs oficiales (Socrata y REST propias), no vía CSV.

### Alternativas descartadas

- **Escribir un adaptador CSV vacío / “plantilla” sin fuente real.** Descartada: deuda y API inestable sin caso de uso.
- **Bajar a reservas CSV en vez de Catalunya/Euskadi solo para “tener CSV”.** Descartada: peor cobertura/esfuerzo frente a APIs maduras ya priorizadas.
- **Copiar un CSV genérico de otro proyecto sin contrastar esquemas.** Descartada: viola fuente oficial primero y reutilización solo con compatibilidad real.

---

## Consecuencias

### Positivas

- Semana 3 entrega ≥2 CCAA con datos reales (Catalunya + Euskadi) sin inventar familia CSV.
- Queda explícito que el N/A del checklist no es un olvido.

### Negativas / riesgos

- Las CCAA cuya mejor vía sea CSV siguen en backlog hasta atacarlas con conector puntual.
- Alguien puede reinterpretar el roadmap como “faltó el CSV de Semana 3”; este ADR lo cierra.

---

## Verificación

- `docs/plans/fase3-checklist.md`: Paso 6 = N/A con nota de familia no priorizada.
- `docs/plans/semana03-plan.md`: decisión Paso 1 documentada.
- No existe paquete `connectors/csv/` (ni equivalente) en ingestion tras el cierre de Semana 3.

---

## Referencias

- `docs/04-roadmap-mvp.md` § Semana 3
- `docs/01-arquitectura-fija.md` § 5.3 (adaptadores por formato)
- `docs/plans/semana03-plan.md` · `docs/plans/fase3-checklist.md`
