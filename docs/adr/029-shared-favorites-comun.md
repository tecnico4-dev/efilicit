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
   - `kind` text NOT NULL: `propia` (Propias de Eficen) | `subcontrata` (obligatorio al compartir).
   - `notes` text nullable (máx. 500).
   - `created_at`.
2. RLS vía `is_app_user()`: SELECT / INSERT / DELETE para cualquier usuario app. INSERT exige `added_by = yo`. Cualquiera puede DELETE.
3. UI: alta solo desde `/favorites/tenders` (icono avión + modal: muestra «Calificada como {kind}» heredado del favorito personal + nota). Listado Común y hub con pestañas Eficen/Subcontrata (estilo Mis alertas | Coincidencias) + burbuja. Sin badge en búsqueda/ficha; sin notificaciones en v1.
4. Si ya existe: no reinsertar; avisar «{nombre} ya ha añadido esta licitación».
5. **Tenant único:** Común asume una sola organización invite-only. Multi-empresa futura requeriría otro ADR (scope por org).

### Alternativas descartadas

- **Flag en `favorites`.** Mezcla privado y compartido; RLS incompatible.
- **Varios aportadores por tender.** Complejidad innecesaria en MVP; basta el primero.
- **DELETE solo del autor.** Choca con “es de todos”; se documenta el riesgo de borrado accidental (confirmación en UI).

## Consecuencias

### Positivas

- Separación clara: personales / Común / oferta.
- Modelo simple y RLS alineado con otras tablas de equipo.

### Negativas / riesgos

- Cualquier invite puede vaciar Común.
- No hay aislamiento multi-tenant.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Multi-org futuro | Documentado; no ampliar sin ADR |
| Borrado accidental | Confirmación en UI; Revertir opcional después |

## Referencias

- [016](016-auth-invite-only-sin-registro-publico.md) · [023](023-mis-licitaciones-pipeline-compartido.md)
- Migraciones `20261112100000_shared_favorites.sql`, `20261112110000_shared_favorites_kind.sql`
