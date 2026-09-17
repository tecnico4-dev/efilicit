# Catálogo de fuentes

Documentación por fuente oficial (PLACSP, TED, CCAA, etc.).

Cada fuente debe indicar: organismo, URL, mecanismo de acceso, formato, frecuencia, identificadores, rate limits, método incremental, scraping (sí/no), cobertura y respaldo si existe.

## Fuentes documentadas (conectores)

| source_code | Documento | Estado |
|---|---|---|
| `placsp` | [placsp.md](placsp.md) | Semana 2 — vertical slice + live local OK |
| `placsp_agregadas` | [placsp_agregadas.md](placsp_agregadas.md) | Semana 3 — estatal ampliada + live local OK |
| `catalunya` | [catalunya.md](catalunya.md) | Semana 3 — CCAA #1 completa (Pasos 7–8) + live OK |
| `euskadi` | [euskadi.md](euskadi.md) | Semana 3 — CCAA #2 completa (Paso 9) + live OK |

## Verificación live (local)

Resultados y comandos: [docs/pruebas.md](../pruebas.md).

| Fuente | Parte |
|---|---|
| `placsp` | Parte A |
| `placsp_agregadas` | Parte B |
| `catalunya` | Parte C |
| `euskadi` | Parte D |

## Cobertura territorial de las 17 CCAA (Semana 4 / Paso 1)

Criterio MVP (`docs/04` § Semana 4): cada CCAA tiene una **ruta de datos oficial identificada** (propia o agregada). No significa un conector por comunidad ni el 100 % de todos los contratos locales.

Detalle y decisiones: [docs/plans/semana04-plan.md](../plans/semana04-plan.md) § Paso 1.

| CCAA | Ruta MVP | Fuente(s) | Conector propio |
|---|---|---|---|
| Andalucía | Agregada | `placsp_agregadas` | No (backlog CSV si hace falta) |
| Aragón | Agregada | `placsp_agregadas` | No (histórico propio limitado) |
| Asturias | Agregada | `placsp_agregadas` | No |
| Illes Balears | Agregada | `placsp_agregadas` | No |
| Canarias | Agregada | `placsp_agregadas` | No |
| Cantabria | Agregada | `placsp_agregadas` | No |
| Castilla-La Mancha | Agregada | `placsp_agregadas` | No |
| Castilla y León | Agregada | `placsp_agregadas` | No |
| Catalunya | Propia (+ solape) | `catalunya` · posible `placsp_agregadas` | Sí — integrado |
| Comunidad de Madrid | Agregada | `placsp_agregadas` | No (evitar Atom propio) |
| Comunitat Valenciana | Agregada | `placsp_agregadas` | No |
| Extremadura | Agregada | `placsp_agregadas` | No |
| Galicia | Agregada | `placsp_agregadas` | No |
| Región de Murcia | Agregada | `placsp_agregadas` | No |
| Comunidad Foral de Navarra | Agregada | `placsp_agregadas` | No |
| País Vasco | Propia (+ solape) | `euskadi` · posible `placsp_agregadas` | Sí — integrado |
| La Rioja | Agregada | `placsp_agregadas` | No |

**Limitaciones de `placsp_agregadas`:** sin menores; solo agregación; no cobertura local exhaustiva. Ver [placsp_agregadas.md](placsp_agregadas.md).

## Pendiente / en curso (Semana 4)

| source_code / tema | Notas |
|---|---|
| `placsp_menores` | `sindicacion_1143` · `contratosMenoresPerfilesContratantes` — Paso 2 Semana 4 (PLACSP-reuse) |
| Deduplicación multi-fuente | Pasos 4–7 Semana 4 |
| CCAA propia extra | **N/A** Semana 4 (0 conectores; cobertura vía agregadas) |
| Reservas CSV (`valencia`, `jcyl`, `canarias`, …) | Backlog si aparece hueco medible frente a agregadas |
| TED y otras | Semanas posteriores según roadmap |

Catálogo de referencia externo (no verdad única): [contratacionabierta.com](https://contratacionabierta.com/).
