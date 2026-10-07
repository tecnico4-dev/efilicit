# 015 - Matching: veto a `auto` si expedientes presentes y distintos

**Fecha:** 07-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El scorer multi-fuente permite `auto` con NIF/CIF + ≥2 señales blandas (CPV, importe ±1 %, misma `publication_date`, título ≥ 0,85) **sin** exigir el mismo expediente. Eso podía fusionar contratos distintos del mismo organismo (p. ej. anualidades 2025 vs 2026 con expediente distinto) y sobrescribir la fila canónica.

---

## Decisión

En `_score_against` (`matching.py`):

- Si **ambas** partes traen expediente y **no coinciden** → nunca `auto`.
- Con NIF + indicios blandas → como mucho `pending`.
- Si falta expediente en un lado → el `auto` por NIF + señales blandas **sigue** disponible.
- El nivel fuerte NIF + mismo expediente no cambia.

### Alternativas descartadas

- **Exigir siempre expediente para `auto`.** Rompe fuentes sin carpeta estable.
- **Veto solo por año de publicación.** Parche; el conflicto de expediente es la señal general.

---

## Consecuencias

- Menos falsos `auto`; más `pending` hasta revisión humana (UI aún en backlog).
- Alineado con “no fusionar ambigüedades a ciegas” del roadmap Semana 4.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Expedientes mal parseados / formatos distintos de la misma carpeta | Fixtures + tests; revisión de `pending` |
| Menos cobertura de auto-merge | Aceptable; calidad > fusión agresiva |

---

## Referencias

- `docs/04-roadmap-mvp.md` § Semana 4 (deduplicación)
- `ingestion/src/efilicit_ingestion/pipeline/matching.py`
- `ingestion/tests/test_matching.py`
