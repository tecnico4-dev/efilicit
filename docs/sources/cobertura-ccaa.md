# Cobertura territorial de las 17 CCAA

> **Estado:** Semana 4 / Paso 1 — inventario de rutas MVP  
> **Última revisión:** 2026-09-17  
> **Norma:** `docs/04-roadmap-mvp.md` § Semana 4 + §1 (definición de cobertura)  
> **Catálogo de referencia externo:** [contratacionabierta.com](https://contratacionabierta.com/) (no sustituye URI oficiales)  
> **Marco legal:** art. 347.3 LCSP — perfiles **alojados** en PLACSP vs publicación por **agregación** desde plataforma autonómica propia

---

## 1. Qué significa “cubierta” en el MVP

> Cada comunidad autónoma tiene **al menos una ruta oficial de datos** identificada y documentada aquí.

La ruta puede ser:

| Tipo de ruta | `source_code` | Quién entra |
|---|---|---|
| **Conector propio** EfiLicit | `catalunya`, `euskadi`, … | CCAA con API/Open Data priorizado e integrado |
| **Agregación PLACSP** | `placsp_agregadas` (`sindicacion_1044`) | CCAA/entes con **plataforma propia** que interconectan con PLACSP |
| **Perfiles alojados PLACSP** | `placsp` (`sindicacion_643`) | CCAA **sin** plataforma propia: perfiles publicados directamente en PLACSP |

**No** significa:

- un conector Python por cada CCAA;
- el 100 % de todos los contratos de todos los organismos locales;
- que no existan Open Data autonómicos adicionales en backlog.

La deduplicación entre fuente propia y canales PLACSP es trabajo de Semana 4 (Pasos 4–7 del plan), no de este inventario.

---

## 2. Resumen ejecutivo

### 2.1 Matriz de las 17 CCAA

| CCAA | Canal PLACSP | `source_code` primario | Conector propio | Alternativa / backlog |
|---|---|---|---|---|
| Andalucía | Agregación | `placsp_agregadas` | No | Open Data Junta (menores / datasets; validar vigencia) |
| Aragón | Perfiles alojados | `placsp` | No | Open Data histórico (~hasta 2021) |
| Asturias | Perfiles alojados | `placsp` | No | Open Data / CSV (reserva) |
| Illes Balears | Perfiles alojados | `placsp` | No | Portal / exports regionales (no priorizado) |
| Canarias | Perfiles alojados | `placsp` | No | `datos.canarias.es` (CSV; reserva) |
| Cantabria | Perfiles alojados | `placsp` | No | — |
| Castilla-La Mancha | Perfiles alojados | `placsp` | No | Portal de contratación regional (consulta) |
| Castilla y León | Perfiles alojados | `placsp` | No | `datosabiertos.jcyl.es` (CSV; reserva) |
| Catalunya | Propia (+ solape agregación) | `catalunya` | Sí — [catalunya.md](catalunya.md) | Solape con `placsp_agregadas` → dedup |
| Comunidad de Madrid | Agregación | `placsp_agregadas` | No | Feed Atom propio — **evitar duplicar** |
| Comunitat Valenciana | Perfiles alojados | `placsp` | No | `dadesobertes.gva.es` (CSV; reserva) |
| Extremadura | Perfiles alojados | `placsp` | No | Portales de consulta regionales |
| Galicia | Agregación | `placsp_agregadas` | No | [contratosdegalicia.gal](https://www.contratosdegalicia.gal/) (portal; evaluar Open Data) |
| Región de Murcia | Perfiles alojados | `placsp` | No | Datos abiertos CARM (datasets anuales / registro) |
| Comunidad Foral de Navarra | Agregación | `placsp_agregadas` | No | `datosabiertos.navarra.es` (anuncios / adjudicaciones) |
| País Vasco | Propia (+ solape agregación) | `euskadi` | Sí — [euskadi.md](euskadi.md) | Solape con `placsp_agregadas` → dedup |
| La Rioja | Agregación | `placsp_agregadas` | No | Open Data menores / portal de consulta |

### 2.2 Conteo por canal (Semana 4)

| Canal | CCAA | Conectores nuevos Semana 4 |
|---|---|---|
| Propias ya integradas (Semana 3) | Catalunya, País Vasco | 0 |
| Agregación (`placsp_agregadas`) | Andalucía, Galicia, Madrid, Navarra, La Rioja | 0 |
| Perfiles alojados (`placsp`) | Aragón, Asturias, Illes Balears, Canarias, Cantabria, Castilla-La Mancha, Castilla y León, Comunitat Valenciana, Extremadura, Región de Murcia | 0 |

**Decisión Semana 4:** 0 conectores CCAA nuevos ([ADR 009](../adr/009-ccaa-propia-extra-na-semana4.md)). Orden de ataque: `placsp_menores` → deduplicación. El único hueco CCAA post-MVP relevante es menores de plataformas agregadas (véase §5).

### 2.3 Limitaciones por canal

**Agregación** ([placsp_agregadas.md](placsp_agregadas.md)):

- no incluye contratos menores;
- solo entidades que publican por **agregación** (perfil no alojado en PLACSP);
- dataset de agregación (subconjunto frente a la plataforma autonómica nativa);
- la composición de entidades agregadas **varía en el tiempo**;
- no garantiza cobertura local exhaustiva.

**Perfiles alojados** ([placsp.md](placsp.md)):

- publican directamente en PLACSP (mismo canal que el sector público estatal de perfiles);
- los contratos menores de esos perfiles entran por [placsp_menores.md](placsp_menores.md) (`sindicacion_1143`);
- no sustituye Open Data autonómicos opcionales en backlog.

**Menores de plataformas solo-agregadas:** fuera de `placsp_menores` y fuera de `placsp_agregadas`. Quedan como **backlog** (p. ej. Open Data de menores en Andalucía o La Rioja).

---

## 3. Fichas por comunidad

Cada ficha resume el mismo esquema mínimo del onboarding: organismo, URL, mecanismo, formato, incremental, scraping, cobertura, respaldo.

### 3.1 Andalucía

| Campo | Valor |
|---|---|
| Canal PLACSP | Agregación (plataforma autonómica propia) |
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No en Semana 4 |
| Fuente oficial agregada | [placsp_agregadas.md](placsp_agregadas.md) · `sindicacion_1044` |
| Menores | No en agregadas ni en `placsp_menores` → backlog |
| Alternativa propia (backlog) | Open Data Junta de Andalucía — datasets de menores / licitaciones; **validar vigencia** antes de atacar |
| Formato esperado (si se ataca) | CSV / JSON / XML Open Data (por confirmar dataset) |
| Scraping | No como primera opción |
| Observaciones | Reserva (`andalucia`). No forzar conector mientras agregadas cubra el ámbito MVP no-menores |

### 3.2 Aragón

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores` para menores de perfiles alojados) |
| Conector EfiLicit | No |
| Alternativa propia | Aragón Open Data — cobertura propia de contratación **histórica** (aprox. hasta ~2021); el flujo vigente pasa por PLACSP |
| Scraping | No |
| Observaciones | Sin plataforma de agregación propia. Reserva baja (`aragon`) |

### 3.3 Asturias

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio con el Ministerio (BOE) — perfiles alojados en PLACSP |
| Alternativa propia (backlog) | Open Data / perfil contratante Asturias (CSV) |
| Scraping | No |
| Observaciones | Reserva (`asturias`). Activar solo si se mide hueco frente a `placsp` |

### 3.4 Illes Balears

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio con el Ministerio (BOE) — perfiles alojados en PLACSP |
| Alternativa propia | Portales / exports de actividad contractual autonómica (consulta); **no** priorizado como ETL MVP |
| Scraping | No |
| Observaciones | Ruta identificada = perfiles alojados. Si aparece Open Data batch estable, documentar ficha propia antes de conector |

### 3.5 Canarias

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio BOE-A-2025-25219 — «tiene alojados todos sus perfiles… en la PLACSP» |
| Alternativa propia (backlog) | `datos.canarias.es` (CSV Open Data) |
| Scraping | No |
| Observaciones | Reserva (`canarias`) |

### 3.6 Cantabria

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio BOE-A-2025-25220 — perfiles alojados en PLACSP |
| Alternativa propia | Sin fuente Open Data batch priorizada en este inventario |
| Scraping | No |
| Observaciones | Cobertura MVP vía `placsp`; cualquier fuente propia futura exige ficha en `docs/sources/` antes de código |

### 3.7 Castilla-La Mancha

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio BOE-A-2025-25221 — perfiles alojados; licitación electrónica vía PLACSP |
| Alternativa propia | Portal de Contratación de Castilla-La Mancha (consulta humana / UI). No tratado como feed ETL prioritario |
| Scraping | No (portal de consulta ≠ Open Data batch) |
| Observaciones | No confundir portal web con fuente de ingesta |

### 3.8 Castilla y León

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio BOE-A-2025-26793 — perfiles alojados en PLACSP |
| Alternativa propia (backlog) | `datosabiertos.jcyl.es` (CSV) |
| Scraping | No |
| Observaciones | Reserva (`jcyl`). Si se implementa, valorar entonces (y solo entonces) un adaptador CSV reutilizable |

### 3.9 Catalunya

| Campo | Valor |
|---|---|
| Canal PLACSP | Agregación (solape) + conector propio |
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
| Canal PLACSP | Agregación (plataforma autonómica propia) |
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Menores | No en agregadas ni en `placsp_menores` → backlog |
| Alternativa propia | Feed Atom `contratos-publicos.comunidad.madrid/feed/licitaciones2` |
| Scraping | No |
| Observaciones | **Decisión Semana 3 (mantenida):** cubierto en gran parte vía agregadas para no-menores; evitar duplicar con un segundo Atom. Reserva baja (`madrid`) |

### 3.11 Comunitat Valenciana

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio con el Ministerio (BOE) — perfiles alojados en PLACSP |
| Alternativa propia (backlog) | `dadesobertes.gva.es` (CSV Open Data) |
| Scraping | No |
| Observaciones | Reserva (`valencia`). Candidata CSV si hubiera que ampliar cobertura propia más allá de PLACSP |

### 3.12 Extremadura

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio BOE-A-2025-25222 — perfiles alojados en PLACSP |
| Alternativa propia | Buscadores / estadísticas regionales de contratación (consulta); sin dataset ETL priorizado en este inventario |
| Scraping | No |
| Observaciones | Ruta identificada = perfiles alojados |

### 3.13 Galicia

| Campo | Valor |
|---|---|
| Canal PLACSP | Agregación (plataforma autonómica propia) |
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Menores | No en agregadas ni en `placsp_menores` → backlog |
| Alternativa propia (evaluar) | [Contratos Públicos de Galicia](https://www.contratosdegalicia.gal/portada.jsp?lang=es) — portal de consulta; comprobar si existe exportación Open Data / API adecuada antes de cualquier conector |
| Scraping | No como primera opción |
| Observaciones | MVP no-menores = agregadas. Un conector propio exigiría ficha dedicada tras verificar acceso oficial batch |

### 3.14 Región de Murcia

| Campo | Valor |
|---|---|
| Canal PLACSP | Perfiles alojados |
| Ruta MVP | `placsp` (+ `placsp_menores`) |
| Conector EfiLicit | No |
| Evidencia de alojamiento | Convenio vigente (BOE) — perfiles **alojados** en PLACSP |
| Alternativa propia (backlog) | Datos abiertos Región de Murcia — p. ej. datasets anuales del registro de contratos CARM (JSON/CSV/XML; a menudo **excluyen menores** y pueden ser por ejercicio) |
| Ejemplo de dataset | https://datosabiertos.regiondemurcia.es/admin/dataset/contratos-carm-2023-excluidos-contratos-menores |
| Scraping | No |
| Observaciones | Útil como complemento histórico/local; no sustituye la ruta `placsp` continua del MVP |

### 3.15 Comunidad Foral de Navarra

| Campo | Valor |
|---|---|
| Canal PLACSP | Agregación (plataforma autonómica propia) |
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Menores | No en agregadas ni en `placsp_menores` → backlog |
| Alternativa propia (backlog) | Gobierno Abierto Navarra — datasets de anuncios / adjudicaciones / registro de contratos |
| Portal Open Data | https://datosabiertos.navarra.es/ |
| Ejemplo | https://datosabiertos.navarra.es/dataset/adjudicaciones-licitaciones (actualización diaria; año en curso) |
| Formatos observados | CSV, JSON, XML, TSV, … |
| Scraping | No |
| Observaciones | Buena candidata post-MVP si se mide solape/hueco frente a agregadas (p. ej. menores u otros huecos) |

### 3.16 País Vasco

| Campo | Valor |
|---|---|
| Canal PLACSP | Agregación (solape) + conector propio |
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
| Canal PLACSP | Agregación (plataforma autonómica propia) |
| Ruta MVP | `placsp_agregadas` |
| Conector EfiLicit | No |
| Menores | No en agregadas ni en `placsp_menores` → backlog |
| Alternativa propia (backlog) | Open Data La Rioja — datasets de menores / portal de consulta de expedientes |
| Scraping | No |
| Observaciones | MVP no-menores = agregadas. Open Data de menores = candidato post-MVP si se prioriza el hueco |

---

## 4. Relación con fuentes estatales

| `source_code` | Rol respecto a CCAA |
|---|---|
| `placsp` | **Ruta territorial** de CCAA/entes con perfiles **alojados** en PLACSP (las 10 del §2.2) |
| `placsp_agregadas` | **Ruta territorial** de CCAA/entes con plataforma propia que publican por **agregación** (Andalucía, Galicia, Madrid, Navarra, La Rioja; también solape con Cat/Euskadi) |
| `placsp_menores` | Menores de perfiles **alojados** — complemento MVP; **no** cubre menores de plataformas solo-agregadas |
| `catalunya` / `euskadi` | Cobertura propia + solape con agregadas a deduplicar |

Cobertura territorial PLACSP del MVP = `placsp` + `placsp_agregadas` (+ `placsp_menores` para alojados) + conectores propios ya integrados.

---

## 5. Backlog (fuera de Semana 4 salvo hueco medible)

Orden orientativo si en el futuro hay que ampliar cobertura más allá de los canales PLACSP ya identificados.

### Hueco pendiente: menores de plataformas agregadas

Las cinco CCAA con plataforma propia (Andalucía, Galicia, Madrid, Navarra, La Rioja) publican no-menores en PLACSP vía `placsp_agregadas`. Sus **contratos menores no** entran en ese dataset ni en `placsp_menores` (este último solo cubre perfiles **alojados**). Ese es el único hueco territorial CCAA que queda frente a los canales PLACSP del MVP.

Si se decide cerrarlo más adelante, rutas batch oficiales ya localizadas:

| Prioridad | CCAA | Acceso observado |
|---|---|---|
| 1ª | Andalucía | Open Data Junta — «Contratación Menor» por ejercicio (CSV/JSON; actualización trimestral) |
| 2ª | La Rioja | Open Data La Rioja — «Contratos menores» por ejercicio (CSV/JSON/XLS/XML) |
| Condicional | Madrid, Galicia, Navarra | Sin dataset Open Data autonómico de menores equivalente al de Andalucía/Rioja en este inventario. Madrid: menores en el portal autonómico + export CSV del buscador (límite de filas). Galicia: consulta por perfil en la plataforma autonómica. Navarra: OD de anuncios/adjudicaciones del portal (solapa con agregadas; no es un pack de menores). Solo si aparece feed batch estable y se mide valor. |

Las diez CCAA con perfiles **alojados** ya cubren no-menores (`placsp`) y menores (`placsp_menores`). Sus CSV/registros autonómicos son transparencia o reexportación, no una ruta territorial pendiente. No se prioriza el Atom de Madrid (solapa con agregadas para no-menores).

Si se implementa un primer conector Open Data de menores (p. ej. Andalucía), valorar entonces —y solo entonces— un adaptador CSV reutilizable.

---

## 6. Referencias

1. Roadmap MVP — Semana 4 y definición de cobertura: `docs/04-roadmap-mvp.md`
2. Fichas: [placsp.md](placsp.md) · [placsp_agregadas.md](placsp_agregadas.md) · [placsp_menores.md](placsp_menores.md) · [catalunya.md](catalunya.md) · [euskadi.md](euskadi.md)
3. Inventario Semana 3 (cola / reservas): [docs/plans/semana03-plan.md](../plans/semana03-plan.md)
4. Plan Semana 4: [docs/plans/semana04-plan.md](../plans/semana04-plan.md)
5. Catálogo de referencia: https://contratacionabierta.com/
6. Art. 347.3 LCSP; convenios CCAA–Ministerio publicados en el BOE (alojamiento de perfiles)
