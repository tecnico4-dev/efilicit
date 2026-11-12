# 030 - Favoritos personales: `kind` Eficen / Subcontrata

**Fecha:** 2026-11-12

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Los favoritos personales (`favorites`) no distinguían si el interés era como **propia de Eficen** o como **subcontrata**. El equipo necesita la misma clasificación que en Común (`shared_favorites.kind`, ADR 029) y que sea **obligatoria al guardar** (corazón / botón), no un filtro posterior.

## Decisión

1. Columna `favorites.kind` NOT NULL: `propia` | `subcontrata` (backfill `propia` en filas existentes).
2. UI: al añadir favorito desde búsqueda, ficha u otros puntos de entrada → modal obligatorio de elección. Quitar no pide kind.
3. Listados personales (hub preview y `/favorites/tenders`) agrupados en dos campos + burbuja por ítem.
4. Al enviar a Común, `shared_favorites.kind` se copia del favorito personal (el modal solo lo muestra; no se vuelve a elegir). Distinto de `tender_ratings.interest_kind` (valoración).

## Alternativas

- Reutilizar solo `tender_ratings.interest_kind`. Descartado: valoración ≠ seguimiento; no todos los favoritos están valorados.
- Inferir kind al compartir a Común. Descartado: el personal debe clasificarse en el alta.

## Consecuencias

- Inserts de `favorites` deben incluir `kind` (scripts/tests RLS).
- Misma taxonomía textual que Común (`FavoriteKind`).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Favoritos antiguos sin intención clara | Backfill a `propia`; el usuario puede quitar y volver a guardar |

## Referencias

- [029](029-shared-favorites-comun.md)
- Migración `20261112120000_favorites_kind.sql`
