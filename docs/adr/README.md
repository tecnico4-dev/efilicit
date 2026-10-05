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
| [003](003-acceso-canonico-publico-etl-privado.md) | Acceso Semana 1: canónico público, ETL privado (`errors` reservada) | Aceptado |
| [004](004-ci-ingestion-sin-postgres.md) | CI de ingestion sin Postgres (tests de DB en skip) | Aceptado |
| [005](005-ingesta-actions-manual-first-cron-off.md) | Ingesta en Actions: manual-first (cron desactivado) | Aceptado |
| [006](006-raw-storage-httpx-sin-supabase-py.md) | RAW Storage vía `httpx` + `service_role` (sin `supabase-py`) | Aceptado |
| [007](007-adaptador-csv-familia-na-semana3.md) | Adaptador CSV de familia: N/A en Semana 3 | Aceptado |
| [008](008-placsp-menores-aplazado-semana4.md) | `placsp_menores` aplazado a Semana 4+ | Aceptado |
