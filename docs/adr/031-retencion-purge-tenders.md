# 031 - Retención canónica: purge de licitaciones con escudos

**Fecha:** 2026-11-16

**Estado:** Aceptado

**Reemplaza:** Ninguno (materializa la política de retención esbozada en la investigación de almacenamiento 2026-11-06 / P6)

**Reemplazado por:** Ninguno

---

## Contexto

El plan Free de Supabase no aguanta histórico ilimitado (~3,6 KB canónicos por licitación + RAW). Tras limpiar huérfanos de Storage, hace falta un **purge** deliberado de licitaciones viejas sin tocar lo que el equipo aún usa.

## Decisión

1. **Herramienta:** script `scripts/purge_tenders.py` + workflow manual `cleanup-tenders.yml` (`workflow_dispatch`). Default **dry-run**; `apply` borra de verdad. Cron externo aplazado.
2. **Selección (include), parámetros por run:**
   - `min_deadline_age_months` (default **3**): candidatas con `deadline_at <= now() - N months`.
   - `source_code` opcional (vacío = todas): solo licitaciones con fila en `tender_sources` de esa fuente.
   - `limit` opcional: tope de borrables tras escudos.
3. **Escudos (skip total** de esa licitación si aplica cualquiera):
   - `offer_cases` (Mis licitaciones) — coherente con RESTRICT ADR 028.
   - `favorites` o `shared_favorites`.
   - `tender_ratings`.
   - Match de alerta **vivo**: fila en `notification_queue` sin `alert_related_trash`, o con papelera aún en ventana de 30 días. Dismiss permanente (vaciar papelera → `trashed_at` fuera de ventana) **no** escuda.
   - Abierta / en plazo: `deadline_at IS NULL` **o** `deadline_at > now()` (red de seguridad; con el filtro de 3 meses casi no salta).
4. **No son escudo** (sí limpieza colateral tras `apply`):
   - `notification_emails.tender_ids` / `tender_count` (histórico de digest): podar IDs borrados; si la lista queda vacía, borrar la fila.
   - Avisos de favoritos/común y cola ya desestimada: caen por CASCADE al borrar el tender o se ignoran.
5. **Borrado (`apply`):** `DELETE` del tender (CASCADE canónico / cola / eventos). Luego `source_artifacts` + objeto Storage `raw` **solo** si el artifact ya no lo referencia nadie. Modelo actual: ~1 entry = 1 fichero (P3 página compartida: reevaluar antes de borrar RAW de página).
6. **Sin UI de producto** en este ADR.

### Alternativas descartadas

- Escudar digests sin leer del buzón — el email es histórico; basta podar arrays.
- Borrar solo filas canónicas y dejar RAW — regenera presión de Storage.
- Soft-delete / tabla archivo — más esquema sin necesidad medible aún.

## Consecuencias

### Positivas

- Política explícita y repetible; dry-run antes de apply.
- Respeta offer / favoritos / alertas vivas / abiertas.

### Negativas / riesgos

- Workflow nuevo no aparece en Actions hasta pasar por `main` (limitación conocida del repo).
- Con P3 (RAW por página) el borrado de Storage debe comprobar compartición.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Borrar de más | Escudos + dry-run + `limit` |
| RAW huérfano tras DELETE | Post-paso artifacts + API Storage |
| Digests con IDs muertos | Podar `notification_emails` |

## Referencias

- Investigación almacenamiento 2026-11-06 (P6)
- [028](028-offer-schema-block-b-integrity.md) — `offer_cases.tender_id` RESTRICT
- [029](029-shared-favorites-comun.md) — favoritos comunes
- Workflow huérfanos: `.github/workflows/cleanup-orphans.yml`
