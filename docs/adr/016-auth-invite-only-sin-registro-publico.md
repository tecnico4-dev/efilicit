# 016 - Auth invite-only: sin registro público ni búsqueda anónima en UI

**Fecha:** 13-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El MVP tenía registro público (`/register`) y búsqueda usable sin sesión. El producto pasa a usuarios **creados solo por administración** (Supabase Auth Dashboard / admin API). Un visitante solo ve la landing e «Iniciar sesión». La búsqueda y el resto de la app requieren sesión.

ADR 003 sigue dejando el canónico legible con `anon` a nivel RLS (ETL/API); este ADR fija la **política de producto en la web**: no hay UX de registro ni de búsqueda anónima.

---

## Decisión

1. **Sin registro público** en la web: `/register` redirige a `/login`; no hay enlaces de «Registrarse».
2. **Usuarios** los crea la administradora en Supabase (email + contraseña temporal o invite).
3. **Búsqueda y rutas de producto** (`/search`, `/tenders`, `/favorites`, `/alerts`, `/account`) exigen sesión (middleware → `/login?next=…`).
4. **Landing anónima** sin cabecera/nav; único CTA: «Iniciar sesión».
5. Tras el **primer login** (si aún no marcó `user_metadata.password_changed`), la UI ofrece **cambiar contraseña de forma opcional**; también disponible siempre en Cuenta.
6. Recomendación operativa: desactivar «Allow new users to sign up» en Supabase Auth para reforzar el cierre a nivel proveedor.

### Alternativas descartadas

- **Mantener registro público.** Descartada: requisito de producto.
- **Forzar cambio de contraseña al primer login.** Descartada: el usuario puede omitirlo («si así lo desea»).
- **Cerrar RLS `anon` del canónico.** Descartada ahora: fuera de alcance; contradiría ADR 003 sin necesidad medida (la UI ya no usa búsqueda anónima).

---

## Consecuencias

### Positivas

- Control de quién entra a la plataforma.
- Landing limpia orientada a login.
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
- `apps/web/src/app/home-dashboard.tsx` (`HomeLanding`)
- `apps/web/src/components/shell/app-shell.tsx`
