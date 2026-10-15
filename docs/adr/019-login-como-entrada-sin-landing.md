# 019 - Login como entrada: sin landing anónima intermedia

**Fecha:** 15-10-2026

**Estado:** Aceptado

**Reemplaza:** [ADR 016](016-auth-invite-only-sin-registro-publico.md) § decisión 4 (landing con CTA «Iniciar sesión»)

**Reemplazado por:** Ninguno

---

## Contexto

ADR 016 fijó invite-only y una **landing anónima** en `/` cuyo único CTA era «Iniciar sesión» → `/login`. Con el login visual como pantalla de entrada, esa landing solo añadía un clic y un componente (`HomeLanding`) sin valor.

El resto de ADR 016 (sin registro público, rutas de producto con sesión, cambio de contraseña opcional) **sigue vigente**.

---

## Decisión

1. **Sin landing intermedia:** un visitante sin sesión en `/` (o tras cerrar sesión) va **directo a `/login`**.
2. Se elimina el componente `HomeLanding` de `apps/web/src/app/home-dashboard.tsx`.
3. El middleware y la home autenticada refuerzan el redirect; logout apunta a `/login`.

### Alternativas descartadas

- **Mantener landing + botón.** Descartada: un solo paso inútil.
- **Montar el formulario de login en `/`.** Descartada ahora: `/login` ya concentra la UX; menos duplicación.

---

## Consecuencias

### Positivas

- Menos código y un flujo más corto.
- Una sola pantalla de entrada (login animado).

### Negativas / riesgos

- Quien espere copy de marketing en `/` ya no lo ve; aceptable en MVP invite-only.

---

## Riesgos

- Ninguno relevante frente a ADR 016; la política invite-only no cambia.

---

## Referencias

- [ADR 016](016-auth-invite-only-sin-registro-publico.md)
- `apps/web/src/lib/supabase/middleware.ts`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/login/`
