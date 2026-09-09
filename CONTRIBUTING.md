# Contribuir a EfiLicit

## Antes de escribir código

1. Lee `docs/00-onboarding.md` y `docs/01-arquitectura-fija.md`.
2. Comprueba en qué fase estás en `docs/04-roadmap-mvp.md`.
3. Respeta `.cursor/rules/` cuando existan.
4. No inventes arquitectura: si hace falta un cambio estructural → ADR en `docs/adr/`.

## Herramientas

Usar las versiones fijadas en `package.json` (`engines` + `packageManager`):

- Node.js **24.x**
- pnpm **10.x** (exacta: la de `packageManager`)
- Python **3.12.x** + **uv** (no `pip install` ad hoc del proyecto)
- Supabase CLI (vía Scoop en Windows, o como dep del monorepo cuando se documente)

## Flujo de trabajo

```text
rama desde main
  → cambios
  → migración si toca DB
  → tests
  → supabase db reset (solo LOCAL)
  → PR
  → CI
  → merge
```

- `main` es la rama principal. **Por ahora no hay branch protection formal en GitHub** (decisión documentada en `.github/README.md`: proyecto de prueba, sin plan Team de pago). Conviene igual evitar force push y no borrar `main`; el CI de Actions sigue siendo la comprobación automática.
- No secretos en Git. Solo plantillas tipo `.env.example`.
- No tocar el esquema de producción a mano.
- Nunca `supabase db reset --linked` contra producción.

## Commits

Prefijos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `security`.

Cambios funcionales relevantes → actualizar `CHANGELOG.md` en el mismo PR.

## Vía oficial de Supabase CLI

En Windows, instalación global recomendada con **Scoop** (ver docs oficiales).  
Cuando el monorepo tenga la dependencia de desarrollo, se podrá unificar en `pnpm supabase …` y documentarlo aquí como única vía de equipo.
