# 031 - SELECT de perfiles entre usuarios app (`users_select_app_peers`)

**Fecha:** 2026-11-12

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

`public.users` solo tenía RLS `users_select_own`. En Común (y otras vistas de equipo) el join `users:added_by (display_name)` devolvía `null` para otros usuarios → toast «Otro usuario ya ha añadido…» aunque el perfil sí tenga nombre.

## Decisión

1. Política adicional `users_select_app_peers`: SELECT para `authenticated` si `is_app_user()`.
2. INSERT/UPDATE de `users` siguen own-only.
3. Aceptable porque el producto es **tenant único invite-only** (ADR 016, 029). Multi-org requeriría scope por organización.

## Alternativas

- **Denormalizar `added_by_display_name` en `shared_favorites`.** Evita el join; se queda obsoleto si cambia el nombre.
- **Vista solo `id` + `display_name`.** Más estricta; más piezas. Diferible si multi-org.

## Consecuencias

- Cualquier invite ve `display_name`, `digest_frequency`, etc. de compañeros. Riesgo bajo en Eficen interna.

## Referencias

- [016](016-auth-invite-only-sin-registro-publico.md) · [029](029-shared-favorites-comun.md)
- Migración `20261112140000_users_select_app_peers.sql`
