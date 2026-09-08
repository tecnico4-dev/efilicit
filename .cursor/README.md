# .cursor/

Reglas del asistente en `rules/`, alineadas con `docs/03-reglas-cursor.md`.

| Archivo | Ámbito |
|---|---|
| `00-project-overview.mdc` | Siempre |
| `01-architecture.mdc` | Siempre |
| `02-python-standards.mdc` | `ingestion/**` |
| `03-typescript-next.mdc` | `apps/web/**`, `packages/**` |
| `04-supabase-migrations.mdc` | `supabase/**` |
| `05-security.mdc` | Siempre |
| `06-testing.mdc` | tests/fixtures |
| `07-etl-connectors.mdc` | `ingestion/**` |
| `08-adr-changelog.mdc` | Siempre |

La sustancia de las reglas es fija respecto a la arquitectura; no sustituyen `docs/01-arquitectura-fija.md`.
