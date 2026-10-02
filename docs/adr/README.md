# Architecture Decision Records

Decisiones de impacto (seguridad, contratos, esquema, orquestación, excepciones a la arquitectura fija) se registran aquí.

**Convención de nombre:** `NNN-titulo-en-kebab-case.md` (numeración correlativa).  
**Plantilla mínima:** Estado · Contexto · Decisión (con alternativas descartadas) · Consecuencias · Riesgos · Fecha · Referencias.

Los ADR **no se reescriben** si cambia la decisión: se marca `Reemplazado por: NNN` y se escribe uno nuevo. La historia no se borra.

No uses un ADR para el estado de una fuente o un parser: eso va en `docs/sources/`.

## Índice

| ADR | Título | Estado |
|---|---|---|
| [001](001-proteccion-main-aplazada.md) | Protección de `main` aplazada (GitHub Free / repo privado) | Aceptado |
| [002](002-bootstrap-supabase-remoto-greenfield.md) | Bootstrap Supabase remoto greenfield (`db push`, no `db pull`) | Aceptado |
