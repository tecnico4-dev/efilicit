# 037 - Aviso in-app al compartir peer (`notification_shared`)

**Fecha:** 2026-11-24

**Estado:** Aceptado

**Reemplaza:** Ninguno (completa [032](032-eficen-members-favorites-shared.md) § avisos peer)

**Reemplazado por:** Ninguno

---

## Contexto

Al compartir una licitación a personas concretas (`favorites_shared`) no había aviso en el buzón del receptor. Común ya tiene `notification_common` (+ `_removed`). El ADR 032 aplazó avisos peer.

## Decisión

1. Tabla **`notification_shared`** (mínima):
   - `share_id` PK → `favorites_shared(id)` ON DELETE CASCADE
   - `read_at`, `trashed_at` (papelera 30 días o purge → DELETE de la fila)
   - Emisor, receptor, tender, kind y fecha salen del join a `favorites_shared`
2. Trigger **AFTER INSERT** en `favorites_shared` → inserta `(share_id)`.
3. **`reactivate_favorite_share`**: al reactivar un share oculto, upsert del aviso (no leído).
4. `has_unread_notifications` / `count_unread_notifications` incluyen esta tabla (join a `to_user_id`).
5. Sin aviso `_removed` en v1.
6. UI buzón: misma fila que Común (headline + título + fecha; papelera / restaurar / purge; open marca leído → ficha con `from=favorites-shared`).

### Enmienda (mismo día)

Se descartan `user_id` y `created_at` en la tabla: redundantes con `favorites_shared`. RLS y badge resuelven el receptor vía `favorites_shared.to_user_id`.

### Alternativas descartadas

- Columnas `notification_*` en `favorites_shared` — mezclan share y buzón; purgar aviso no puede ser DELETE del share.
- PK `(user_id, tender_id)` — dos emisores distintos al mismo tender colisionarían.
- Denormalizar `user_id` / `created_at` en el aviso — innecesario en peer 1:1.

## Consecuencias

### Positivas

- Esquema mínimo; CASCADE limpia el buzón si desaparece el share.

### Negativas / riesgos

- Badge/RLS/listado hacen join a `favorites_shared` (aceptable con volumen peer).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Reactivación sin INSERT trigger | Upsert explícito en `reactivate_favorite_share` |

## Referencias

- [032](032-eficen-members-favorites-shared.md) · [029](029-shared-favorites-comun.md)
- Migraciones `20261124120000_notification_shared.sql`, `20261124130000_notification_shared_slim.sql` (local primero)
