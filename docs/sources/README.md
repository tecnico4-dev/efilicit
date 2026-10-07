# Catálogo de fuentes

Documentación por fuente oficial (PLACSP, TED, CCAA, etc.).

Cada fuente debe indicar: organismo, URL, mecanismo de acceso, formato, frecuencia, identificadores, rate limits, método incremental, scraping (sí/no), cobertura y respaldo si existe.

### Al añadir un `source_code` nuevo (obligatorio)

No basta con ficha + conector + CLI. También hay que:

1. **Incluir el `source_code` en `SOURCE_PRIORITY`** (`ingestion/.../canonical_repo.py`) con un hueco de ranking coherente (p. ej. familia PLACSP por encima de CCAA propias).
2. **Actualizar la tabla de prioridades** en [ADR 015](../adr/015-fuente-ganadora-canonica.md) (o ADR que lo reemplace): sin eso, la fuente cae al default “desconocido” y **casi nunca gana** la copia canónica frente a las ya listadas.
3. Ficha en este catálogo + tests/fixtures + workflow si aplica.

Detalle de producto: [ADR 015 — fuente ganadora](../adr/015-fuente-ganadora-canonica.md).

## Fuentes documentadas (conectores)

| source_code | Documento | Estado |
|---|---|---|
| `placsp` | [placsp.md](placsp.md) | Semana 2 — vertical slice + live local OK |
| `placsp_agregadas` | [placsp_agregadas.md](placsp_agregadas.md) | Semana 3 — estatal ampliada + live local OK |
| `placsp_menores` | [placsp_menores.md](placsp_menores.md) | Semana 4 — conector completo (Paso 2) |
| `catalunya` | [catalunya.md](catalunya.md) | Semana 3 — CCAA #1 completa + live OK |
| `euskadi` | [euskadi.md](euskadi.md) | Semana 3 — CCAA #2 completa + live OK |

## Cobertura territorial (17 CCAA)

Inventario Semana 4: [cobertura-ccaa.md](cobertura-ccaa.md).

Criterio MVP: ruta oficial identificada (propia, agregación PLACSP o perfiles alojados), no un conector por comunidad.

| Resumen | Detalle |
|---|---|
| Propias integradas | Catalunya (`catalunya`), País Vasco (`euskadi`) |
| Agregación (`placsp_agregadas`) | Andalucía, Galicia, Madrid, Navarra, La Rioja |
| Perfiles alojados (`placsp`) | Aragón, Asturias, Illes Balears, Canarias, Cantabria, Castilla-La Mancha, Castilla y León, Comunitat Valenciana, Extremadura, Región de Murcia |
| CCAA extra Semana 4 | N/A (0 conectores nuevos) |

## Verificación live (local)

Resultados y comandos: [docs/pruebas.md](../pruebas.md).

| Fuente | Parte |
|---|---|
| `placsp` | Parte A |
| `placsp_agregadas` | Parte B |
| `catalunya` | Parte C |
| `euskadi` | Parte D |

## Pendiente / en curso

| Tema | Notas |
|---|---|
| Reservas CSV / Open Data CCAA | Backlog — ver [cobertura-ccaa.md](cobertura-ccaa.md) §5 |
| UI de revisión humana de matches `pending` | Semana 5+ (evolución prevista: `match_suggestions`) |
| TED y otras | Semanas posteriores según roadmap |

## Completado en Semana 4

| Tema | Notas |
|---|---|
| Conector `placsp_menores` | Completo (ficha + CLI + workflow) |
| Cobertura 17 CCAA | [cobertura-ccaa.md](cobertura-ccaa.md) — rutas identificadas |
| Deduplicación multi-fuente | Matching + upsert (`auto` / `pending` / `unmatched`) + fixtures de solape |

Catálogo de referencia externo (no verdad única): [contratacionabierta.com](https://contratacionabierta.com/).
