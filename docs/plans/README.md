# Plans — planes y checklists por semana

Aquí se documenta **cómo se ha decidido ejecutar** cada semana del roadmap (orden de pasos, defaults y decisiones tomadas al completar la fase anterior), y los **checklists** para marcar el avance.

## Convención

| Tipo | Nombre | Cuándo |
|---|---|---|
| Plan de ejecución | `semana00-plan.md`, `semana01-plan.md`, … | Al **iniciar** la semana (tras cerrar la anterior) |
| Checklist de cierre | `fase0-checklist.md`, `fase1-checklist.md`, … | Al **iniciar** la semana; se va marcando hasta el cierre |

- Los documentos `docs/00`–`docs/04` son la norma de referencia; **no se sustituyen** por estos planes.
- Cada `semanaXX-plan` debe incluir una sección **Decisiones durante la ejecución** que se actualiza a medida que se cierran pasos (lo acordado *antes* de implementar el siguiente).
- No inventar arquitectura en los planes: si hace falta un cambio estructural → ADR.

## Índice

| Semana / fase | Plan | Checklist | Estado |
|---|---|---|---|
| Semana 0 / Fase 0 (setup) | [semana00-plan.md](semana00-plan.md) | [fase0-checklist.md](fase0-checklist.md) | Cerrada |
| Semana 1 / Fase 1 (canónico + ingesta) | [semana01-plan.md](semana01-plan.md) | [fase1-checklist.md](fase1-checklist.md) | Cerrada |
| Semana 2 / Fase 2 (PLACSP vertical slice) | [semana02-plan.md](semana02-plan.md) | [fase2-checklist.md](fase2-checklist.md) | Cerrada |
| Semana 3 / Fase 3 (escalado estatal + primeras CCAA) | [semana03-plan.md](semana03-plan.md) | [fase3-checklist.md](fase3-checklist.md) | En curso (1–5 + 7–9.5 OK; 6 N/A; siguiente Paso 10) |
| Semana 4+ | Se añadirán `semana04-plan.md` / `fase4-checklist.md` al arrancar | — | Pendiente |

## Relación con el roadmap

El orden macro sigue [`docs/04-roadmap-mvp.md`](../04-roadmap-mvp.md). Estos archivos detallan la **secuencia operativa** acordada en el proyecto, no redefinen la columna vertebral.
