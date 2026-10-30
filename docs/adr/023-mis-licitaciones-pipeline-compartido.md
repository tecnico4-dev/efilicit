# 023 - Mis licitaciones: pipeline de presentación compartido (Eficen)

**Fecha:** 2026-10-30

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Favoritos es seguimiento personal de licitaciones canónicas. Eficen necesita además un espacio de **trabajo de presentación**: a qué licitaciones se va a presentar / se está presentando / se ha presentado la empresa, con responsable, fechas, novedades, checklist con plazos, documentación reutilizable e histórico por años.

No es un favorito privado: es un **tablero operativo compartido** entre cuentas invite-only de la organización.

## Decisión

1. Tablas nuevas (PostgreSQL / RLS):
   - `bid_cases` — una fila por licitación canónica en el pipeline (única por `tender_id`).
   - `bid_case_checklist_items` — requisitos con `due_at` / `done_at`.
   - `bid_case_updates` — novedades / hitos de texto.
   - `bid_documents` — biblioteca de documentos (URL externa en MVP; tags para reutilizar).
   - `bid_case_documents` — vínculo N:M caso ↔ documento.
2. Etapas (`stage`): `interes` | `preparacion` | `presentada` | `adjudicada` | `no_adjudicada` | `descartada`. Activas = las tres primeras; histórico = las tres últimas (agrupable por año de `presented_on` / `outcome_on`).
3. **Compartido entre usuarios de la app** (invite-only): cualquier fila de `public.users` con sesión puede leer/escribir el pipeline. No es owner-only como favoritos/alertas.
4. UI: ruta `/my-tenders` (+ detalle `/my-tenders/[id]`); entrada en cabecera a la **izquierda del buzón**. Desde la ficha de licitación: «Añadir a Mis licitaciones».
5. Documentos MVP = título + URL + tags (sin bucket Storage todavía). Un documento de la biblioteca se puede enlazar a varios casos.

### Alternativas descartadas

- **Reutilizar `favorites`.** Mezcla seguimiento personal con pipeline de oferta; no tiene etapas ni checklist.
- **Owner-only por usuario.** Impide que el equipo vea el mismo caso; el producto es “Eficen se presenta”, no “yo sigo”.
- **Tabla única JSONB monolítica.** Peor para checklist/docs/RLS y consultas por etapa/año.
- **Storage de ficheros en este ADR.** Aplazado; URLs externas bastan para arrancar.

## Consecuencias

### Positivas

- Separación clara favoritos (persona) vs pipeline (empresa).
- Modelo canónico intacto: el caso apunta a `tenders.id`.
- Extensible a Storage / plantillas de checklist sin romper el contrato.

### Negativas / riesgos

- Cualquier usuario invite-only ve y edita todo el pipeline (aceptable mientras el tenant sea una sola org).
- Sin Storage, los “documentos” dependen de enlaces externos.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Multi-tenant futuro | Nuevo ADR + scoping por org; no asumir forever-shared |
| URL de documento rota / sin control | Tags + notas; Storage en iteración posterior |
| Duplicar caso al añadir desde ficha | `unique (tender_id)` + upsert-friendly UI |

## Referencias

- [016](016-auth-invite-only-sin-registro-publico.md) — invite-only (tenant = org)
- Favoritos Semana 6 — contraste owner-only
- Reglas: RLS en tablas expuestas; sin `service_role` en web
