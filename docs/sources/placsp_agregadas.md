# PLACSP — Licitaciones por agregación (sin menores)

> **source_code:** `placsp_agregadas`  
> **Estado en el proyecto:** Semana 3 — primera fuente estatal ampliada (Paso 2)  
> **Última revisión de esta ficha:** 2026-09-15  
> **Scraping:** no (existe feed / descarga oficial)  
> **Adaptador previsto:** PLACSP-reuse (Atom/CODICE; parametrizar conector Semana 2)

---

## 1. Organismo / fuente

| Campo | Valor |
|---|---|
| Nombre corto | PLACSP (agregación) |
| Nombre completo | Plataforma de Contratación del Sector Público — mecanismos de agregación |
| Organismo responsable | Ministerio de Hacienda — Dirección General del Patrimonio del Estado (Subdirección General de Coordinación de la Contratación Electrónica) |
| Portal | https://contrataciondelsectorpublico.gob.es/ |
| Datos abiertos (portal PLACSP) | https://contrataciondelsectorpublico.gob.es/wps/portal/DatosAbiertos |
| Ficha de datos abiertos (Hacienda) | https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesAgregacion.aspx |
| Catálogo datos.gob.es | https://datos.gob.es/es/catalogo/e05250001-licitaciones-publicadas-en-la-plataforma-mediante-mecanismos-de-agregacion-excluyendo-los-contratos-menores |

Alias histórico del dominio: `contrataciondelestado.es`. Preferir `contrataciondelsectorpublico.gob.es` en URLs nuevas.

---

## 2. Qué dataset usamos

**Conjunto objetivo:**

> Licitaciones publicadas en PLACSP mediante **mecanismos de agregación** por entidades del Sector Público que **no** tienen su perfil del contratante alojado en PLACSP, **excluyendo contratos menores**.

Canal de sindicación oficial:

```text
sindicacion_1044
```

Nombre base del feed / paquetes:

```text
PlataformasAgregadasSinMenores
```

### Relación con otros `source_code` PLACSP

| `source_code` | Dataset | Mezclar aquí |
|---|---|---|
| `placsp` | Perfiles alojados en PLACSP, sin menores (`sindicacion_643`) | No |
| `placsp_menores` | Contratos menores de perfiles alojados (`sindicacion_1143`) | No (Semana 4 Paso 2) |
| `placsp_agregadas` | Este dataset (`sindicacion_1044`) | — |

No mezclar paquetes de distintas sindicaciones en el mismo `source_code`.

---

## 3. Mecanismo de acceso (orden de preferencia del proyecto)

| Preferencia | ¿Aplica? | Detalle |
|---|---|---|
| 1. API oficial de consulta pública | No para este dataset | Misma lógica que `placsp`: B2B no es reutilización abierta masiva |
| 2. Open Data oficial | Sí | Hacienda / datos.gob.es / portal PLACSP |
| 3. Feeds / XML oficiales | Sí — **mecanismo elegido** | Atom Syndication + payload CODICE |
| 4. Descarga de fichero oficial | Sí | ZIP anuales / mensuales en URI conocida |
| 5. Scraping | No | No necesario |

**Decisión de acceso para EfiLicit:** descarga HTTP de paquetes ZIP (y/o ficheros `.atom`) desde las URI oficiales de `sindicacion_1044`. Sin autenticación para datos abiertos. Sin scraping HTML.

Feed Atom “vivo” (datos.gob.es):

```text
https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores.atom
```

Para el conector batch preferimos el mismo patrón que Semana 2: **ZIP mensuales** por URI conocida (más estable para `artifact_key` y RAW).

---

## 4. Formato

| Aspecto | Detalle |
|---|---|
| Contenedor | ZIP con uno o varios ficheros `.atom` |
| Transporte | Atom Syndication Format ([RFC 4287](https://www.ietf.org/rfc/rfc4287.html)) |
| Semántica de expediente | CODICE (extensiones PLACSP / PLACE) embebidas en cada `entry` |
| Versión de referencia | Misma familia que `placsp` (~CODICE 2.07 / especificación de sindicación PLACSP) |
| Encoding | XML UTF-8 (según ficheros publicados) |
| Paginación | Máximo **500** `entry` por fichero; continuación vía `atom:link` con `rel="next"` |

Especificación oficial del formato (compartida con el resto de sindicaciones PLACSP):

- https://contrataciondelsectorpublico.gob.es/datosabiertos/especificacion-sindicacion.pdf

Cada `entry` representa un expediente (o su actualización). La semántica es compatible con el parser Atom/CODICE de Semana 2; el conector debe usar **`source_code = placsp_agregadas`** y las URLs/nombres de este dataset.

---

## 5. URLs de descarga (URI bien conocidas)

Base:

```text
https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/
```

### Año en curso (paquetes mensuales)

Patrón oficial (Hacienda):

```text
PlataformasAgregadasSinMenores_AAAAMM.zip
```

Ejemplo:

```text
https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores_202609.zip
```

El paquete del mes actual refleja actualizaciones hasta el **día previo**.

También existe un archivo **anual incremental** del año en curso (listado en la ficha de Hacienda).

### Años cerrados (histórico)

Paquetes anuales desde **2016** hasta el año anterior, listados en la misma ficha. Patrón habitual:

```text
PlataformasAgregadasSinMenores_AAAA.zip
```

### Cómo leer un ZIP

1. Descomprimir el paquete.
2. Empezar por el fichero base:

   ```text
   PlataformasAgregadasSinMenores.atom
   ```

3. Seguir los `atom:link rel="next"` hacia ficheros posteriores del mismo paquete.
4. El último fichero de un paquete enlaza con el primero del paquete anterior (cadena histórica).

---

## 6. Frecuencia de actualización

| Ritmo | Comportamiento |
|---|---|
| Diario | Se publican las actualizaciones del **día anterior** |
| Misma licitación, varias veces | Una licitación puede reaparecer en el feed cada vez que cambia |
| Paquetes | Histórico por años desde 2016; año actual por meses (+ incremental anual) |

Implicación: feed de **eventos/actualizaciones**; upsert idempotente por `(source_code, source_tender_id)`.

### Observabilidad / incidencias conocidas

En octubre 2025 hubo avisos públicos (datos.gob.es) de paradas temporales del feed/ZIP y errores de acceso; Hacienda las registró como incidencias. El conector y `source_sync` deben detectar corridas con volumen anómalo o fallos HTTP (no asumir que “cero registros” es un día vacío sin más contexto).

---

## 7. Identificadores útiles

| Señal | Origen típico | Uso en EfiLicit |
|---|---|---|
| `atom:id` / id de entry | Atom | Identidad de la entrada/publicación en el feed |
| `ContractFolderID` | CODICE | Número de expediente en la fuente |
| NIF/CIF del órgano | CODICE | Señal primaria de identidad de organismo cuando exista |
| DIR3 / id de plataforma | CODICE | Señal auxiliar de organismo |
| URL del expediente | `atom:link` | `source_url` / trazabilidad humana |
| CPV | CODICE | Clasificación |
| NUTS / lugar de ejecución | CODICE | Geografía |

**Regla ya fijada:** nunca usar solo el nombre del organismo como identidad única.

Clave canónica de fuente:

```text
source_code = placsp_agregadas
source_tender_id = <mismo criterio de identidad de expediente que placsp>
```

**Criterio de identidad (alineado con Semana 2 / `placsp.md`):**

```text
{tax_id|platform_id}:{ContractFolderID}
```

cuando exista identificador de órgano (NIF/CIF preferente; si no, id de plataforma).  
Si no hay órgano identificable → solo `ContractFolderID`.  
Si tampoco hay expediente → `atom:id` (último recurso).  
Entradas sin ninguna de estas señales se **omiten**.

---

## 8. Límites / rate limits / condiciones

| Tema | Observación |
|---|---|
| Autenticación | No requerida para sindicación de datos abiertos |
| Rate limit publicado | No hay un límite numérico explícito en la ficha consultada |
| Tamaño | ZIPs anuales / mensuales pueden ser grandes; timeouts + `max_bytes` |
| Cortesía | Descargas batch razonables; reintentos con backoff |
| TLS / dominio | HTTPS; respetar redirecciones del dominio oficial |
| Condiciones de uso | Aviso legal Hacienda: https://www.hacienda.gob.es/es-ES/Paginas/Avisolegal.aspx |

---

## 9. Método incremental

Misma estrategia que `placsp`, con prefijo RAW distinto:

1. **`discover`:** paquetes mensuales pendientes (`artifact_key` = nombre del ZIP).
2. **`fetch`:** bytes + SHA-256 + timeout/retry/`max_bytes`.
3. **RAW:** `raw/placsp_agregadas/AAAA/MM/DD/...` en Storage.
4. **Parseo:** Atom/CODICE → `SourceRecord` (reutilizar parser; no contaminar DDL canónico).
5. **Upsert:** `(placsp_agregadas, source_tender_id)`.
6. **Checkpoint:** cursor en `source_sync` por este `source_code`.

---

## 10. Cobertura

| Aspecto | Detalle |
|---|---|
| Ámbito | Entidades que publican en PLACSP **por agregación** (perfil **no** alojado en PLACSP) |
| Exclusiones | Contratos menores; perfiles alojados en PLACSP (van en `placsp`) |
| Periodo | Desde **2016** (la composición de entidades agregadas **varía en el tiempo**) |
| Territorial | CCAA/entes con **plataforma propia** que interconectan con PLACSP (Andalucía, Galicia, Madrid, Navarra, La Rioja; solape con Catalunya/Euskadi). Matriz: [cobertura-ccaa.md](cobertura-ccaa.md). **No** es la ruta de CCAA con perfiles alojados (esas van en `placsp`) |
| Menores | Excluidos de este dataset; tampoco entran en `placsp_menores` (solo perfiles alojados) → backlog si se priorizan |

No garantiza el 100 % de todos los contratos locales de cada CCAA. Catalunya y Euskadi tienen además conector propio; el resto de CCAA con plataforma propia usan este canal como ruta MVP no-menores.

---

## 11. Fuente alternativa / respaldo

| Recurso | Rol |
|---|---|
| Ficha Hacienda / listados ZIP | Descubrimiento oficial de paquetes |
| Feed Atom vivo `PlataformasAgregadasSinMenores.atom` | Incremental fino; batch primario = ZIP mensuales |
| OpenPLACSP | QA humana; no es el pipeline |
| [contratacionabierta.com](https://contratacionabierta.com/) | Catálogo de referencia; no sustituye URI oficial |
| Fuentes CCAA propias (`catalunya`, `euskadi`, …) | Cobertura propia / solapamiento a deduplicar en Semana 4 |

---

## 12. Observaciones para el conector (Semana 3)

- **Reutilizar** el conector PLACSP de Semana 2 parametrizando `source_code`, base de sindicación y `FEED_BASE_NAME` — no clonar el parser.
- **Discover + fetch:** `PlacspConnector(syndication=PLACSP_AGREGADAS)`; `fetch` reutiliza `download_bytes` con el `source_url` del artefacto (timeout, retry, `max_bytes`, checksum). Tests con `fetch_transport` inyectado — **sin red en unit tests**.
- **RAW (Paso 4.1):** `fetch_validate_and_store_raw` + `validate_artifact` (magic ZIP) → Storage `raw/placsp_agregadas/AAAA/MM/DD/...` + `source_artifacts`.
- **Parse (Paso 4.2):** reutilizar `parse_placsp_artifact` (Atom/CODICE); ZIP base `PlataformasAgregadasSinMenores.atom`.
- **Normalize + identidad (Paso 4.3):** reutilizar `stages.normalize` / `stages.resolve_identity` (NIF/CIF prioritario; confidence HIGH/MEDIUM/LOW).
- **Upsert (Paso 4.4):** reutilizar `CanonicalRepository` / `run_pipeline`; unique `(placsp_agregadas, source_tender_id)`; `artifact_id` en `tender_sources`; `source_sync` con contadores.
- **CLI E2E (Paso 4.5):** `run-placsp --syndication placsp_agregadas --fixture … --dry-run` (mismo entrypoint que perfiles).
- **Workflow (Paso 5):** [`.github/workflows/ingest-placsp.yml`](../../.github/workflows/ingest-placsp.yml) con input `syndication=placsp_agregadas`; default `dry-run`; cron desactivado.
- Stack aprobado: `httpx` + `lxml` + `tenacity` + Pydantic; RAW en Supabase Storage.
- Fixtures Atom/ZIP propios de este dataset (o reutilizar fixtures CODICE si la estructura es idéntica y se etiquetan con este `source_code` en tests).
- Tests unitarios sin red.

### Campos canónicos prioritarios (MVP)

Igual que `placsp`: título/objeto, estado, fechas, importes, CPV, tipo/procedimiento, organismo (NIF/CIF cuando exista), URL, trazabilidad RAW.

---

## 13. Referencias

1. Ficha datos abiertos Hacienda — agregación (sin menores):  
   https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesAgregacion.aspx
2. Catálogo datos.gob.es (mismo conjunto):  
   https://datos.gob.es/es/catalogo/e05250001-licitaciones-publicadas-en-la-plataforma-mediante-mecanismos-de-agregacion-excluyendo-los-contratos-menores
3. Especificación de sindicación (PDF):  
   https://contrataciondelsectorpublico.gob.es/datosabiertos/especificacion-sindicacion.pdf
4. Ficha hermana Semana 2: [placsp.md](placsp.md)
5. Plan Semana 3: [docs/plans/semana03-plan.md](../plans/semana03-plan.md)
6. Arquitectura fija — conectores y fuente oficial primero: `docs/01-arquitectura-fija.md`
