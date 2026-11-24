# 037 - Aviso in-app al compartir peer (`notification_shared`)

**Fecha:** 2026-11-24

**Estado:** Aceptado

**Reemplaza:** Ninguno (completa [032](032-eficen-members-favorites-shared.md) § avisos peer)

**Reemplazado por:** Ninguno

---

## Contexto

Al compartir una licitación a personas concretas (`favorites_shared`) no había aviso en el buzón del receptor. Común ya tiene `notification_common` (+ `_removed`). El ADR 032 aplazó avisos peer.

## Decisión

1. Tabla **`notification_shared`**:
   - `share_id` PK → `favorites_shared(id)` ON DELETE CASCADE
   - `user_id` (= receptor / `to_user_id`) para RLS y badge
   - `created_at`, `read_at`, `trashed_at` (papelera 30 días o purge → DELETE de la fila)
2. Trigger **AFTER INSERT** en `favorites_shared` → inserta aviso para `to_user_id`.
3. **`reactivate_favorite_share`**: al reactivar un share oculto, upsert del aviso (no leído, `created_at` ahora).
4. `has_unread_notifications` / `count_unread_notifications` incluyen esta tabla.
5. Sin aviso `_removed` en v1 (quitar share ≠ notificación al emisor).
6. UI buzón (copy, listado, open) en incremento siguiente; este ADR fija el contrato de datos.

### Alternativas descartadas

- Columnas `notification_*` en `favorites_shared` — mezclan share y buzón; purgar aviso no puede ser DELETE del share.
- PK `(user_id, tender_id)` — dos emisores distintos al mismo tender colisionarían.

## Consecuencias

### Positivas

- Mismo patrón mental que Común (fila de aviso independiente).
- CASCADE limpia el buzón si desaparece el share.

### Negativas / riesgos

- Listado del buzón aún no consume la tabla hasta el incremento UI.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Reactivación sin INSERT trigger | Upsert explícito en `reactivate_favorite_share` |

## Referencias

- [032](032-eficen-members-favorites-shared.md) · [029](029-shared-favorites-comun.md)
- Migración `20261124120000_notification_shared.sql` (local primero)
