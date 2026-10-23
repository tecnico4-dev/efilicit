# Capa de acceso a datos (queries)

Centralizar aquí el acceso a Supabase (no en componentes React).
Los Server Components / Actions importan helpers tipados; la UI no arma SQL.

## Búsqueda (Semana 5 / Paso 3 / ADR 011)

Contrato: búsqueda = RPC `public.search_tenders` (SECURITY INVOKER). Semántica de tokens/ranking abajo (CHANGELOG + migraciones `20261022130000_*` / `20261022140000_*`); no hay ADR aparte.

- `searchTenders(client, { query, criteria, limit, offset })` → RPC `public.search_tenders`
- `listSearchFilterOptions(client)` → RPC `list_tender_filter_options` (status / procedimiento / tipo / CCAA con datos)
- Tokens: `normalizeSearchQuery` / `tokenizeKeywords` (`@/lib/keywords`) — stopwords ES fuera; AND de tokens ≥2 chars. Misma regla en alertas (`ingestion/.../alerts/keywords.py`). Texto solo-stopwords en `/search` → aviso UI, sin RPC.
- Pipeline RPC: filtros Criteria v1 (sí/no) → ramas FTS y `pg_trgm` (errata) con **top-K ≈ 300** cada una → merge → orden
  `rank` → `publication_date` → `cpv_hit_count` (si hay `p_cpv_codes`) → `created_at` → `LIMIT`/`OFFSET`.
- UI `/search`: mismo pager que favoritos (`ListPager`; `?page=` + `?ps=` 10/20/50/100); `total_count` en la RPC; ancla `#resultados` + scroll interno arriba al paginar. Nueva búsqueda (submit) vuelve a página 1 / `ps` por defecto.
- Trgm solo si `char_length(query)` ∈ [3, 120]. FTS: `search_vector` / `spanish`. Trgm: `similarity`/`%` y `strict_word_similarity`/`<<%` sobre `title`.
- Badge: `fts` solo si los tokens aparecen **literalmente** en el título; stemming-only o trgm → `trgm` (UI “errata”); sin texto → `filter`.
- Cliente publishable + sesión; nunca `service_role`

Ejemplo (Node / consola con env de la web):

```ts
import { createSupabaseClient } from "@/lib/supabase/client";
import { searchTenders } from "@/lib/queries";

const client = createSupabaseClient();
const { data, error } = await searchTenders(client, {
  query: "mantenimiento software",
  criteria: { version: 1, cpv_codes: ["72000000"] },
  limit: 10,
});
```

Comprobación SQL directa: ver plan Semana 5 / checklist Paso 3.

## Ficha de licitación (Semana 6 / Pasos 3–4)

- `getTenderById(client, id)` → `tenders` + `contracting_authorities` + `tender_sources`
- `listTenderStatusHistory(client, id)` → hitos de estado desde `tender_events` (compactados)
- UI: `/tenders/[id]`; enlace desde resultados de `/search`; «Histórico registrado» junto al estado
- Multi-fuente: lista de orígenes con badge “Canónica” si coincide `canonical_source_code`

## Favoritos (Semana 6 / Paso 5)

- `addOwnFavorite` / `removeOwnFavorite` / `isOwnFavorite` / `listOwnFavorites`
- `listOwnFavorites` incluye `last_seen_at` = `max(tender_sources.last_seen_at)` (UI «Datos actualizados»)
- Tabla `favorites` (RLS owner-only); UI: toggle en ficha (solo sesión) + `/favorites`
- Prueba A≠B: `pnpm --filter @efilicit/web verify:rls:favorites`

## Alertas / búsquedas / perfil (Semana 5 / Paso 6)

- `createOwnAlert` / `updateOwnAlert` / `deleteOwnAlert` / `ownAlertNameTaken` / `listOwnAlerts`
- `createOwnSavedSearch` / `deleteOwnSavedSearch` / `listOwnSavedSearches`
- `getOwnProfile` / `updateOwnDigestFrequency` (daily|weekly; ADR 013)
- UI: `/alerts` (crear/editar/activar), crear alerta desde `/search` (sesión), `/account`
- Prueba RLS Alice≠Bob: `pnpm --filter @efilicit/web verify:rls`

## Notificaciones in-app

- `listFavoriteStatusNotifications` → favoritos ∩ cambios de estado (`tender_events`) + `notification_reads` / `notification_trash` (página `/notifications` y home)
- `hasUnreadFavoriteStatusNotifications` → RPC `has_unread_favorite_status_notifications` (EXISTS); solo para el badge del `AppShell` (no montar la lista en cada nav)
