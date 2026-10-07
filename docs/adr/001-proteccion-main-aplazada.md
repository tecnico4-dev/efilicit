# 001 - Protección de `main` aplazada (GitHub Free / repo privado)

**Fecha:** 09-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

La arquitectura fija (`docs/01-arquitectura-fija.md`) declara `main` **protegida** en GitHub: evitar force push, borrados y, en la medida de lo posible, cambios sin pasar por comprobaciones.

Durante el setup (Fase 0 / Paso 6) se intentó aplicar branch protection / ruleset sobre `main`. En un repositorio **privado** con cuenta GitHub **Free** (sin organización con plan Team o superior), esa protección **no está disponible**.

El proyecto en ese momento es pequeño y de prueba: no se justificaba contratar un plan de pago solo para activar el bloqueo formal de la rama.

---

## Decisión

**No aplicar** branch protection / ruleset sobre `main` **por ahora**.

Queda en vigor:

- CI en GitHub Actions (lint / typecheck / build web + smoke de ingestion) en push/PR a `main`.
- Disciplina manual: no force push ni borrar `main`.
- Push directo a `main` permitido mientras el equipo sea reducido.

Cuando el proyecto crezca o exista plan Team (u otro modelo de cuenta que permita la feature), se **reactivará** la protección formal. Hasta entonces este requisito del setup se considera **no aplicable** (aplazado a propósito), no olvidado.

### Alternativas descartadas

- **Contratar GitHub Team / org de pago solo para branch protection.** Descartada: coste sin necesidad medible en un repo privado de prueba.
- **Hacer el repositorio público para usar protection en Free.** Descartada: no se quiere exponer el código ni el historial de setup por ese motivo.
- **Simular protection solo con convención social y sin documentarlo.** Descartada: la arquitectura fija pide `main` protegida; hay que dejar constancia explícita de la excepción y de las mitigaciones.

---

## Consecuencias

### Positivas

- Se puede completar el setup y el CI sin bloquear el trabajo por un límite de plan de GitHub.
- La excepción queda auditada (este ADR + `.github/README.md`).

### Negativas

- `main` no tiene barrera técnica contra force push, borrado o commits sin CI verde.
- Cualquier colaborador con permiso de escritura puede empujar directo a `main`.

### Riesgos

- Error humano en `main` sin red de seguridad de ruleset. Mitigación: equipo pequeño, CI visible, recuperar vía historial git si hace falta.
- Olvidar reactivar la protection cuando el plan lo permita. Mitigación: este ADR marca el estado como temporal y el criterio de reactivación.

---

## Verificación

- En Settings → Branches / Rules del repo **no** hay rule activa sobre `main` (intencional).
- El workflow `.github/workflows/ci.yml` sigue ejecutándose en push/PR a `main`.
- El detalle operativo vive en [`.github/README.md`](../../.github/README.md) § «Protección de `main`».

---

## Referencias

- `docs/01-arquitectura-fija.md` — SCM: `main` protegida
- `docs/02-setup-entorno.md` — checklist de GitHub / CI
- `docs/plans/semana00-plan.md` — Paso 6
- `.github/README.md`
