# 032 - Directorio `eficen_members` y favoritos peer (`favorites_shared`)

**Fecha:** 2026-11-16

**Estado:** Aceptado

**Reemplaza:** Ninguno (complementa [029](029-shared-favorites-comun.md); renombra su tabla)

**Reemplazado por:** Ninguno

---

## Contexto

Hace falta un directorio visible del equipo (nombres / rol) para pickers de compartir y para Mis licitaciones, sin ampliar el `SELECT` de `public.users` (perfil privado: email, digest, favoritos propios).

Además: compartir una licitación favorita a **personas concretas** (no solo a Común), con una pestaña distinta de enviadas/recibidas. `company_people` (CV/medios legacy del esquema oferta) no tiene UI y se sustituye por el mismo directorio.

## Decisión

1. **`eficen_members`** (directorio Eficen):
   - `id`, `display_name` NOT NULL, `role_title` nullable, `user_id` nullable **UNIQUE** → `users(id)` ON DELETE SET NULL, `active` boolean default true, `avatar_url` nullable (UI: iniciales si null).
   - RLS: `SELECT` para `is_app_user()`. Sin policies de escritura authenticated (alta/enlace por admin BD / `service_role`).
   - Mis licitaciones (`offer_assigned_people.person_id`, `offer_requirement_evidence.person_id`) apunta aquí.

### Enmienda 2026-11-18

- Se eliminan `created_at` / `updated_at` (y su trigger): sin uso de producto.
- Se añade `avatar_url` nullable para iconos futuros; default visual = iniciales.
2. **Drop `company_people`** tras retargetar FKs (sin UI ni datos de producto).
3. **Rename** `shared_favorites` → **`favorites_common`** (mismo contrato; triggers/FK de `notification_common` siguen al PK `tender_id`). Al insertar, `added_by_display_name` preferirá el nombre del miembro enlazado si existe.
4. **`favorites_shared`** (peer share):
   - Columnas: `id`, `tender_id`, `from_user_id`, `to_user_id`, `kind`, `notes`, `created_at`, `hidden_by_from_at`, `hidden_by_to_at`.
   - **N filas** (una por destinatario). `UNIQUE (tender_id, from_user_id, to_user_id)`. `CHECK (from <> to)`.
   - **Quitar por lado:** `hide_favorite_share(id)` pone el timestamp del caller; si ambos lados ocultos → `DELETE` de la fila. SELECT RLS solo filas con el lado propio visible (A puede quitar sin que B pierda el share).
   - Reenvío tras hide: `reactivate_favorite_share` limpia hides si la fila sigue existiendo; si ambos visibles → «ya enviado».
   - RLS: SELECT si soy `from`/`to` y mi `hidden_by_*` es null; DELETE si soy party (cleanup); INSERT solo como `from` + `is_app_user()`; `to_user_id` debe ser `eficen_members.user_id` activo (no subquery a `users`: RLS own-only impediría enviar a peers).
   - UI: avión → Común | Personas (multi-select); ruta `/favorites/shared` (enviadas + recibidas). Sin avisos in-app peer ni papelera en este ADR.
5. **`users` sigue own-only.** Nombres de compañeros vía `eficen_members` (o copia denormalizada ya existente en Común).

### Alternativas descartadas

- Ampliar SELECT de `users` entre peers — rechazado en 029; se mantiene.
- Cabecera + tabla de destinatarios — RLS y borrado parcial más complejos; N filas bastan.
- Reutilizar `company_people` como directorio — contrato de CV/medios distinto; sin login.
- Avisos peer en el mismo incremento — se puede añadir después sin cambiar el modelo.

## Consecuencias

### Positivas

- Separación clara cuenta vs ficha Eficen.
- Picker de personas sin filtrar PII de `users`.
- Común y compartidos peer son tablas/pantallas distintas.
- Un solo directorio para favoritos y Mis licitaciones.

### Negativas / riesgos

- Miembros sin `user_id` no aparecen en el picker de share (correcto hasta que se enlacen).
- Sin UI admin de miembros (operativa BD).
- Rename rompe refs de código/tipos hasta actualizarlas en el mismo cambio.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Unique peer-share confunde “ya enviado” | Toast claro; no abrir modal si ya existe el par |
| Borrado accidental de miembro con FKs RESTRICT | Admin consciente; ON DELETE SET NULL solo en `user_id` |

## Referencias

- [029](029-shared-favorites-comun.md) · [026](026-mis-licitaciones-offer-cases.md) · [030](030-favorites-kind-eficen-subcontrata.md)
- Migraciones `20261116150000` … `20261116180000` (local primero)
