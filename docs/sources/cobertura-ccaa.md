# Cobertura territorial de las 17 CCAA

> **Estado:** Semana 4 / Paso 1 — inventario de rutas MVP  
> **Última revisión:** 2026-09-17  
> **Norma:** `docs/04-roadmap-mvp.md` § Semana 4 + §1 (definición de cobertura)  
> **Catálogo de referencia externo:** [contratacionabierta.com](https://contratacionabierta.com/) (no sustituye URI oficiales)

---

## 1. Qué significa “cubierta” en el MVP

> Cada comunidad autónoma tiene **al menos una ruta oficial de datos** identificada y documentada aquí.  
> La fuente puede ser **propia** (conector EfiLicit) o una **fuente agregada** (`placsp_agregadas`) si realmente ofrece los datos necesarios.

**No** significa:

- un conector Python por cada CCAA;
- el 100 % de todos los contratos de todos los organismos locales;
- que no existan Open Data autonómicos adicionales en backlog.

La deduplicación entre fuente propia y agregadas es trabajo de Semana 4 (Pasos 4–7 del plan), no de este inventario.

---

## 2. Resumen ejecutivo

| CCAA | Ruta MVP | `source_code` primario | Conector propio | Alternativa / backlog |
|---|---|---|---|---|
| Andalucía | Agregada | `placsp_agregadas` | No | Open Data Junta (validar dataset vigente) |
| Aragón | Agregada | `placsp_agregadas` | No | Open Data propio histórico (~hasta 2021) |
| Asturias | Agregada | `placsp_agregadas` | No | Open Data / CSV (reserva Semana 3) |
| Illes Balears | Agregada | `placsp_agregadas` | No | Portal / exports regionales (no priorizado) |
| Canarias | Agregada | `placsp_agregadas` | No | `datos.canarias.es` (CSV; reserva Semana 3) |
| Cantabria | Agregada | `placsp_agregadas` | No | — |
| Castilla-La Mancha | Agregada | `placsp_agregadas` | No | Portal de contratación regional (consulta) |
| Castilla y León | Agregada | `placsp_agregadas` | No | `datosabiertos.jcyl.es` (CSV; reserva Semana 3) |
| Catalunya | Propia (+ solape) | `catalunya` | Sí — [catalunya.md](catalunya.md) | Solape con `placsp_agregadas` → dedup |
| Comunidad de Madrid | Agregada | `placsp_agregadas` | No | Feed Atom propio — **evitar duplicar** |
| Comunitat Valenciana | Agregada | `placsp_agregadas` | No | `dadesobertes.gva.es` (CSV; reserva Semana 3) |
| Extremadura | Agregada | `placsp_agregadas` | No | Portales de consulta regionales |
| Galicia | Agregada | `placsp_agregadas` | No | [contratosdegalicia.gal](https://www.contratosdegalicia.gal/) (portal; evaluar Open Data ETL) |
| Región de Murcia | Agregada | `placsp_agregadas` | No | Datos abiertos CARM (datasets anuales / registro) |
| Comunidad Foral de Navarra | Agregada | `placsp_agregadas` | No | `datosabiertos.navarra.es` (anuncios / adjudicaciones) |
| País Vasco | Propia (+ solape) | `euskadi` | Sí — [euskadi.md](euskadi.md) | Solape con `placsp_agregadas` → dedup |
| La Rioja | Agregada | `placsp_agregadas` | No | Portal de consulta regional |

**Decisión Semana 4:** 0 conectores CCAA nuevos. Orden de ataque: `placsp_menores` → deduplicación. Reservas CSV = backlog si aparece hueco medible.

### Limitaciones de la ruta agregada (todas las filas “Agregada”)

Documentadas en [placsp_agregadas.md](placsp_agregadas.md):

- no incluye contratos menores;
- solo entidades que publican por **agregación** (perfil no alojado en PLACSP);
- la composición de entidades agregadas **varía en el tiempo**;
- no garantiza cobertura local exhaustiva.

Complemento estatal de menores (perfiles alojados): [placsp_menores.md](placsp_menores.md) (`sindicacion_1143`).

---

## 3. Fichas por comunidad

Cada ficha resume el mismo esquema mínimo del onboarding: organismo, URL, mecanismo, formato, incremental, scraping, cobertura, respaldo.

### 3.1 Andalucía

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No en Semana 4 |
| Fuente oficial agregada | [placsp_agregadas.md](placsp_agregadas.md) · `sindicacion_1044` |
| Alternativa propia (backlog) | Portal de datos abiertos de la Junta de Andalucía — **validar dataset vigente** antes de atacar (en Semana 3 se anotó URL previa 404) |
| Formato esperado (si se ataca) | CSV / otro Open Data (por confirmar) |
| Scraping | No como primera opción |
| Observaciones | Reserva Semana 3 (`andalucia`). No forzar conector mientras agregadas cubra el ámbito MVP |

### 3.2 Aragón

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia | Aragón Open Data — cobertura propia de contratación **histórica** (aprox. hasta ~2021); después el flujo habitual pasa por PLACSP |
| Scraping | No |
| Observaciones | Reserva baja Semana 3 (`aragon`). Preferir agregadas/PLACSP |

### 3.3 Asturias

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia (backlog) | Open Data / perfil contratante Asturias (CSV; volumen alto en catálogo de referencia) |
| Scraping | No |
| Observaciones | Reserva Semana 3 (`asturias`). Activar solo si se mide hueco frente a agregadas |

### 3.4 Illes Balears

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia | Portales / exports de actividad contractual autonómica (consulta ciudadana); **no** priorizado como ETL MVP |
| Scraping | No |
| Observaciones | Ruta identificada = agregadas. Si aparece Open Data batch estable, documentar ficha propia antes de conector |

### 3.5 Canarias

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia (backlog) | `datos.canarias.es` (CSV Open Data) |
| Scraping | No |
| Observaciones | Reserva Semana 3 (`canarias`) |

### 3.6 Cantabria

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia | Sin fuente Open Data batch priorizada en el inventario Semana 3–4 |
| Scraping | No |
| Observaciones | Cobertura MVP vía agregadas; cualquier fuente propia futura exige ficha en `docs/sources/` antes de código |

### 3.7 Castilla-La Mancha

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia | Portal de Contratación de Castilla-La Mancha (consulta humana / UI). No tratado como feed ETL prioritario |
| Scraping | No (portal de consulta ≠ Open Data batch) |
| Observaciones | No confundir portal web con fuente de ingesta |

### 3.8 Castilla y León

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia (backlog) | `datosabiertos.jcyl.es` (CSV) |
| Scraping | No |
| Observaciones | Reserva Semana 3 (`jcyl`). Si se implementa, valorar entonces (y solo entonces) un adaptador CSV reutilizable |

### 3.9 Catalunya

| Campo | Valor |
|---|---|
| Ruta MVP | Propia |
| Conector EfiLicit | Sí — `catalunya` |
| Ficha | [catalunya.md](catalunya.md) |
| Mecanismo | SODA / Socrata `ybgg-dgi6` (JSON paginado) |
| Solape | Posible con `placsp_agregadas` → matching Semana 4 |
| Scraping | No |
| Live | [docs/pruebas.md](../pruebas.md) Parte C |
| Observaciones | Primera CCAA propia (Semana 3). No reimplementar |

### 3.10 Comunidad de Madrid

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia | Feed Atom `contratos-publicos.comunidad.madrid/feed/licitaciones2` |
| Scraping | No |
| Observaciones | **Decisión Semana 3 (mantenida):** ya cubierto en gran parte vía agregadas; evitar duplicar con un segundo Atom. Reserva baja (`madrid`) |

### 3.11 Comunitat Valenciana

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia (backlog) | `dadesobertes.gva.es` (CSV Open Data) |
| Scraping | No |
| Observaciones | Reserva Semana 3 (`valencia`). Primera candidata CSV si hubiera que ampliar cobertura propia |

### 3.12 Extremadura

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia | Buscadores / estadísticas regionales de contratación (consulta); sin dataset ETL priorizado en este inventario |
| Scraping | No |
| Observaciones | Ruta identificada = agregadas |

### 3.13 Galicia

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia (evaluar) | [Contratos Públicos de Galicia](https://www.contratosdegalicia.gal/portada.jsp?lang=es) — portal de consulta; comprobar si existe exportación Open Data / API adecuada antes de cualquier conector |
| Scraping | No como primera opción |
| Observaciones | MVP = agregadas. Un conector propio exigiría ficha dedicada tras verificar acceso oficial batch |

### 3.14 Región de Murcia

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia (backlog) | Datos abiertos Región de Murcia — p. ej. datasets anuales del registro de contratos CARM (JSON/CSV/XML; a menudo **excluyen menores** y pueden ser por ejercicio) |
| Ejemplo de dataset | https://datosabiertos.regiondemurcia.es/admin/dataset/contratos-carm-2023-excluidos-contratos-menores |
| Scraping | No |
| Observaciones | Útil como complemento histórico/local; no sustituye la ruta agregada continua del MVP |

### 3.15 Comunidad Foral de Navarra

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia (backlog) | Gobierno Abierto Navarra — datasets de anuncios / adjudicaciones / registro de contratos |
| Portal Open Data | https://datosabiertos.navarra.es/ |
| Ejemplo | https://datosabiertos.navarra.es/dataset/adjudicaciones-licitaciones (actualización diaria; año en curso) |
| Formatos observados | CSV, JSON, XML, TSV, … |
| Scraping | No |
| Observaciones | Buena candidata post-MVP si se mide solape/hueco frente a agregadas |

### 3.16 País Vasco

| Campo | Valor |
|---|---|
| Ruta MVP | Propia |
| Conector EfiLicit | Sí — `euskadi` |
| Ficha | [euskadi.md](euskadi.md) |
| Mecanismo | API REST KontratazioA `contracting-notices` (10 ítems/página) |
| Solape | Posible con `placsp_agregadas` → matching Semana 4 |
| Scraping | No |
| Live | [docs/pruebas.md](../pruebas.md) Parte D |
| Observaciones | Segunda CCAA propia (Semana 3). No reimplementar |

### 3.17 La Rioja

| Campo | Valor |
|---|---|
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Alternativa propia | Portales de consulta de expedientes regionales; sin feed ETL priorizado en este inventario |
| Scraping | No |
| Observaciones | Ruta identificada = agregadas |

---

## 4. Relación con fuentes estatales

| `source_code` | Rol respecto a CCAA |
|---|---|
| `placsp` | Perfiles alojados en PLACSP (ámbito estatal de perfiles; no es “ruta CCAA”) |
| `placsp_agregadas` | **Ruta territorial principal** para CCAA/entes sin perfil alojado |
| `placsp_menores` | Menores de perfiles alojados — complemento MVP; no cubre menores solo-agregados |
| `catalunya` / `euskadi` | Cobertura propia + solape a deduplicar |

---

## 5. Backlog (fuera de Semana 4 salvo hueco medible)

Orden orientativo si en el futuro hay que ampliar conectores propios (heredado de Semana 3 + este inventario):

1. `valencia` (CSV GVA)
2. `jcyl` (CSV CyL)
3. `canarias` / `asturias` / `andalucia` (CSV u Open Data, tras validar)
4. `navarra` (Open Data Gobierno de Navarra)
5. Galicia / Murcia — solo tras confirmar acceso batch oficial estable
6. `madrid` Atom — **evitar** mientras agregadas baste
7. `aragon` histórico — baja prioridad

Adaptador CSV de **familia**: N/A hasta que exista al menos un conector CSV puntual que demuestre reutilización real.

---

## 6. Referencias

1. Roadmap MVP — Semana 4 y definición de cobertura: `docs/04-roadmap-mvp.md`
2. Fichas: [placsp_agregadas.md](placsp_agregadas.md) · [placsp_menores.md](placsp_menores.md) · [catalunya.md](catalunya.md) · [euskadi.md](euskadi.md)
3. Inventario Semana 3 (cola / reservas): [docs/plans/semana03-plan.md](../plans/semana03-plan.md)
4. Plan Semana 4: [docs/plans/semana04-plan.md](../plans/semana04-plan.md)
5. Catálogo de referencia: https://contratacionabierta.com/
