# Inventario RLS — tablas `public` expuestas

Revisión Semana 6 / Paso 9 (hardening). Norma: RLS en **todas** las tablas del esquema `public` que el cliente o la API puedan tocar; `service_role` / conexión directa solo en procesos confiables ([ADR 003](../adr/003-acceso-canonico-publico-etl-privado.md)).

## Cómo revalidar

```bash
# Desde la raíz del repo, con Supabase local arriba:
npx supabase db query --local -f scripts/verify_rls_enabled.sql
```

Esperado: cero filas (toda tabla `public` con `relrowsecurity = true`).  
Pruebas owner-only (Alice≠Bob):

```bash
pnpm --filter @efilicit/web verify:rls
pnpm --filter @efilicit/web verify:rls:favorites
```

## Inventario (MVP)

| Tabla | RLS | Acceso cliente | Notas |
|---|---|---|---|
| `users` | Sí | select/update/insert **own** | Perfil app ↔ `auth.users` |
| `saved_searches` | Sí | CRUD **own** | Favoritos con nombre |
| `recent_searches` | Sí | CRUD **own** | Historial auto (máx. 5); escritura vía `record_recent_search` |
| `alerts` | Sí | CRUD **own** | |
| `notification_queue` | Sí | select **own** | Escritura vía job (service) |
| `notification_emails` | Sí | select/update/delete **own** | Insert vía job al enviar digest ([ADR 022](../adr/022-digest-email-inbox-in-app.md)); antes `digest_inbox_notifications` |
| `notification_favorites` | Sí | CRUD **own** | Estado UI favoritos (read/trash/deleted); sustituye `notification_reads` + `notification_trash` |
| `favorites` | Sí | select/insert/delete **own** | |
| `tender_ratings` | Sí | select/insert/update/delete **own** | Nota 1–5 por licitación (buzón) |
| `tenders` | Sí | select **public** | Canónico lectura |
| `tender_sources` | Sí | select **public** | |
| `tender_events` | Sí | select **public** | |
| `tender_cpvs` | Sí | select **public** | |
| `documents` | Sí | select **public** | |
| `contracting_authorities` | Sí | select **public** | |
| `suppliers` | Sí | select **public** | |
| `geo_ccaa` / `geo_municipio` | Sí | select **public** | Catálogos |
| `source_sync` | Sí | **sin** policies a anon/auth | Revoke + RLS; solo ETL |
| `source_artifacts` | Sí | idem | |
| `errors` | Sí | idem | Pipeline no escribe sistemático (BACKLOG) |

Políticas owner-only usan `(select auth.uid())` (initplan; migración `20261028130000_…`). `setup_rls_smoke` retirada en la misma migración.

## RPCs sensibles

Las funciones de notificaciones / favoritos / búsqueda usan `SECURITY INVOKER` o comprueban `auth.uid()` según migración. No ampliar `EXECUTE` a `anon` en RPCs de datos de usuario.

## Hallazgos Paso 9

- Tablas de dominio usuario y canónico: RLS presente y alineado a owner-only o lectura pública.
- Tablas ETL: opacas al frontend (correcto).
- Sin cambio de políticas en este paso; revisión documental + script de comprobación + scripts Alice≠Bob existentes.
