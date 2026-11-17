# 001 - Protección de `main` (aplazada → reactivada)

**Fecha:** 09-09-2026 (aplazamiento) · **Reactivación:** 17-11-2026

**Estado:** Cerrado — protección activa

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno (sin ADR nuevo; enmienda en este mismo documento a petición del equipo)

---

## Contexto (histórico)

La arquitectura fija (`docs/01-arquitectura-fija.md`) declara `main` **protegida** en GitHub: evitar force push, borrados y, en la medida de lo posible, cambios sin pasar por comprobaciones.

Durante el setup (Fase 0 / Paso 6) se intentó aplicar branch protection sobre `main`. En un repositorio **privado** con cuenta GitHub **Free**, esa protección **no estaba disponible**. El proyecto era pequeño/de prueba y no se justificaba contratar Team solo por ese bloqueo.

---

## Decisión original (09-09-2026)

**No aplicar** branch protection sobre `main` **por entonces**. Quedaba CI + disciplina manual; push directo permitido. Criterio de reactivación: plan Team **u otro modelo de cuenta** (p. ej. repo público en Free) que permita la feature.

### Alternativas descartadas entonces

- Contratar GitHub Team solo para branch protection.
- Hacer el repositorio público solo para usar protection en Free.
- Simular protection solo con convención social sin documentarlo.

---

## Enmienda — reactivación (17-11-2026)

El repositorio pasó a **público**. En GitHub Free, **protected branches** están disponibles en repos públicos. Se **activó** branch protection classic sobre `main`.

### Configuración activa (Settings → Branches)

- Pattern: `main`
- **Require a pull request before merging** (entrada a `main` vía PR; sin Code Owners / dismiss stale obligatorios en el momento de documentar)
- **Require status checks to pass** + **Require branches to be up to date**:
  - `Web lint / typecheck / build`
  - `Ingestion CLI + pytest` (nombre del job en `.github/workflows/ci.yml`)
- **Allow force pushes** desmarcado
- **Allow deletions** desmarcado
- `enforce_admins` no forzado (admins pueden bypass si hace falta)

Detalle operativo: [`.github/README.md`](../../.github/README.md) § «Protección de `main`».

---

## Consecuencias actuales

### Positivas

- Alineado con arquitectura fija: `main` protegida.
- No hace falta plan Team mientras el repo sea público.
- CI obligatorio antes de mergear (checks anteriores).

### Negativas / riesgos

- Flujo: rama → PR → merge (no push directo de commits nuevos a `main`).
- Si se renombra un job del CI, hay que actualizar los required status checks.
- Si el repo volviera a privado en Free, la protection podría dejar de estar disponible otra vez.

---

## Verificación

- Settings → Branches: rule activa sobre `main`.
- Workflow `.github/workflows/ci.yml` en push/PR a `main`.
- Ver también CONTRIBUTING y checklist Fase 0.

---

## Referencias

- `docs/01-arquitectura-fija.md` — SCM: `main` protegida
- `docs/02-setup-entorno.md` — checklist de GitHub / CI
- `docs/plans/semana00-plan.md` — Paso 6
- `.github/README.md`
