# EfiLicit

Plataforma de vigilancia de contratación pública: ingiere licitaciones de fuentes oficiales, las unifica en un modelo canónico y permite buscarlas y recibir alertas.

## Documentación (leer en este orden)

1. [docs/00-onboarding.md](docs/00-onboarding.md) — visión del sistema  
2. [docs/01-arquitectura-fija.md](docs/01-arquitectura-fija.md) — decisiones no negociables  
3. [docs/02-setup-entorno.md](docs/02-setup-entorno.md) — montar el entorno  
4. [docs/03-reglas-cursor.md](docs/03-reglas-cursor.md) — reglas para el asistente  
5. [docs/04-roadmap-mvp.md](docs/04-roadmap-mvp.md) — plan fase a fase  

Planes y checklists por semana: [docs/plans/](docs/plans/).  
Decisiones de arquitectura (ADR): [docs/adr/](docs/adr/README.md).

## Estructura del monorepo

```text
apps/web/          # Frontend Next.js (búsqueda, Auth, alertas)
packages/          # Paquetes compartidos (tipos TS generados, etc.)
ingestion/         # Motor ETL Python 3.12 + uv (conectores + alertas batch)
supabase/          # Config, migraciones y seed
docs/              # Norma (00–04), planes, ADR, fuentes, pruebas
.github/           # CI + workflows de ingesta y digest de alertas
.cursor/rules/     # Reglas del asistente
```

## Requisitos de herramientas (Fase 0)

Versiones fijadas por este repositorio:

| Herramienta   | Versión        |
|---------------|----------------|
| Node.js       | 24.x           |
| pnpm          | 10.x (`packageManager`: 10.33.0) |
| Python        | 3.12.x         |
| uv            | reciente       |
| Docker        | Desktop/Engine en marcha |
| Supabase CLI  | reciente       |

Comprobación rápida:

```powershell
git --version
docker info
node --version
pnpm --version
py -3.12 --version
uv --version
supabase --version
```

## Estado actual

Semana 5 cerrada (búsqueda + Auth + alertas). Siguiente: Semana 6 del roadmap (web integrada / UX).

Workflows de GitHub: [`.github/README.md`](.github/README.md).

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) y el roadmap en `docs/04-roadmap-mvp.md`.

## Changelog

Ver [CHANGELOG.md](CHANGELOG.md).
