# 029 - Favoritos Común (`shared_favorites`)

**Fecha:** 2026-11-12

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

`favorites` es seguimiento **personal** (RLS own). El equipo Eficen necesita además una carpeta **Común**: licitaciones que cualquiera puede promover desde sus favoritos, visibles a todo el tenant, con nota opcional y autor de la primera promoción.

No es Mis licitaciones / `offer_*` (pipeline de oferta).

## Decisión

1. Tabla `shared_favorites`:
   - PK = `tender_id` (una fila por licitación).
   - `added_by` → `users.id` (quien la compartió primero).
   - `added_by_display_name` text nullable: copia del nombre al compartir (para UI/toasts sin leer `users` ajenos; RLS de perfiles sigue own-only).
   - `kind` text NOT NULL: `propia` (Propias de Eficen) | `subcontrata` (obligatorio al compartir).
   - `notes` text nullable (máx. 500).
   - `created_at`.
2. RLS vía `is_app_user()`: SELECT / INSERT / DELETE para cualquier usuario app. INSERT exige `added_by = yo`. Cualquiera puede DELETE.
3. UI: alta solo desde `/favorites/tenders` (icono avión + modal: muestra «Calificada como {kind}» heredado del favorito personal + nota). Listado Común y hub con pestañas Eficen/Subcontrata (estilo Mis alertas | Coincidencias) + burbuja. Sin badge en búsqueda/ficha.
4. Si ya existe: no abrir modal; toast inmediato. Si `added_by` soy yo → «Ya has añadido esta licitación»; si otro → «{added_by_display_name} ya ha añadido esta licitación» (fallback «Otro usuario» si el nombre estaba vacío).
5. Avisos in-app (`notification_common`): PK `(user_id, tender_id)`; FK a `shared_favorites(tender_id)` **ON DELETE CASCADE**; fan-out por trigger a todos los usuarios app excepto `added_by`. Autor/kind/fecha se leen de `shared_favorites` (sin denormalizar). `read_at` / `trashed_at`; caducidad 30 días o eliminar definitivo → **DELETE** de la fila (sin `deleted`).
6. **Tenant único:** Común asume una sola organización invite-only. Multi-empresa futura requeriría otro ADR (scope por org).

### Alternativas descartadas

- **Flag en `favorites`.** Mezcla privado y compartido; RLS incompatible.
- **Varios aportadores por tender.** Complejidad innecesaria en MVP; basta el primero.
- **DELETE solo del autor.** Choca con “es de todos”; se documenta el riesgo de borrado accidental (confirmación en UI).
- **Ampliar SELECT de `users` entre compañeros.** Expone más que el nombre; se evita con la copia en `added_by_display_name`.

## Consecuencias

### Positivas

- Separación clara: personales / Común / oferta.
- Modelo simple y RLS alineado con otras tablas de equipo.
- Nombre del autor visible en Común sin relajar RLS de perfiles.

### Negativas / riesgos

- Cualquier invite puede vaciar Común.
- No hay aislamiento multi-tenant.
- Si el usuario cambia `display_name`, las filas ya compartidas conservan el nombre de entonces.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Multi-org futuro | Documentado; no ampliar sin ADR |
| Borrado accidental | Confirmación en UI; Revertir opcional después |

## Referencias

- [016](016-auth-invite-only-sin-registro-publico.md) · [023](023-mis-licitaciones-pipeline-compartido.md)
- Migraciones `20261112100000_shared_favorites.sql`, `20261112110000_shared_favorites_kind.sql`, `20261112142000_shared_favorites_added_by_display_name.sql`, `20261112160000_notification_common.sql`
