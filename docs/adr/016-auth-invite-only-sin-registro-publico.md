# 016 - Auth invite-only: sin registro público ni búsqueda anónima en UI

**Fecha:** 13-10-2026 (actualizado 15-10-2026: entrada directa a `/login`)

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El MVP tenía registro público (`/register`) y búsqueda usable sin sesión. El producto pasa a usuarios **creados solo por administración** (Supabase Auth Dashboard / admin API). Un visitante sin sesión llega a la pantalla de **iniciar sesión**; la búsqueda y el resto de la app requieren sesión.

ADR 003 sigue dejando el canónico legible con `anon` a nivel RLS (ETL/API); este ADR fija la **política de producto en la web**: no hay UX de registro ni de búsqueda anónima.

---

## Decisión

1. **Sin registro público** en la web: no hay ruta ni enlaces de «Registrarse».
2. **Usuarios** los crea la administradora en Supabase (email + contraseña temporal o invite).
3. **Búsqueda y rutas de producto** (`/search`, `/tenders`, `/favorites`, `/alerts`, `/account`) exigen sesión (middleware → `/login?next=…`).
4. **Entrada anónima = `/login`:** `/` sin sesión y el cierre de sesión redirigen a `/login` (sin landing intermedia con un botón «Iniciar sesión»).
5. Tras el **primer login** (si no hay `user_metadata.password_changed` ni `password_offer_seen`), la UI ofrece **cambiar contraseña de forma opcional**. «Continuar sin cambiar» persiste `password_offer_seen` y **no se vuelve a mostrar**. El cambio sigue disponible siempre en Cuenta.
6. Recomendación operativa: desactivar «Allow new users to sign up» en Supabase Auth para reforzar el cierre a nivel proveedor.

### Alternativas descartadas

- **Mantener registro público.** Descartada: requisito de producto.
- **Forzar cambio de contraseña al primer login.** Descartada: el usuario puede omitirlo («si así lo desea»).
- **Cerrar RLS `anon` del canónico.** Descartada ahora: fuera de alcance; contradiría ADR 003 sin necesidad medida (la UI ya no usa búsqueda anónima).
- **Landing anónima en `/` con CTA a login.** Descartada: solo añadía un clic; la entrada es `/login`.

---

## Consecuencias

### Positivas

- Control de quién entra a la plataforma.
- Flujo corto: sin sesión → pantalla de login.
- Contraseña temporal administrable + cambio opcional en primer acceso.

### Negativas / riesgos

- Quien conozca la URL y la anon key aún podría llamar RPC de lectura (ADR 003); mitigación futura si hace falta.
- Hay que crear usuarios a mano (o script admin) antes de cada onboarding.

---

## Riesgos

- Si el signup de Supabase sigue abierto, alguien podría registrarse vía API Auth aunque la UI no lo ofrezca → desactivar signup en el panel.

---

## Referencias

- [ADR 003](003-acceso-canonico-publico-etl-privado.md)
- `apps/web/src/lib/supabase/middleware.ts`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/login/`
- `apps/web/src/components/shell/app-shell.tsx`
