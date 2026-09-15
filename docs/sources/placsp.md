# PLACSP — Licitaciones por perfil de contratante

> **source_code:** `placsp`  
> **Estado en el proyecto:** Semana 2 — vertical slice (primera fuente real)  
> **Última revisión de esta ficha:** 2026-09-11  
> **Scraping:** no (existe feed / descarga oficial)

---

## 1. Organismo / fuente

| Campo | Valor |
|---|---|
| Nombre corto | PLACSP |
| Nombre completo | Plataforma de Contratación del Sector Público |
| Organismo responsable | Ministerio de Hacienda — Dirección General del Patrimonio del Estado (Subdirección General de Coordinación de la Contratación Electrónica) |
| Portal | https://contrataciondelsectorpublico.gob.es/ |
| Datos abiertos (portal PLACSP) | https://contrataciondelsectorpublico.gob.es/wps/portal/DatosAbiertos |
| Ficha de datos abiertos (Hacienda) | https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesContratante.aspx |

Alias histórico del dominio: `contrataciondelestado.es` (redirige / coexiste con `contrataciondelsectorpublico.gob.es`). Preferir el dominio actual en URLs nuevas.

---

## 2. Qué dataset usamos en Semana 2

**Conjunto objetivo del vertical slice:**

> Licitaciones publicadas en los perfiles del contratante **alojados en PLACSP**, **excluyendo contratos menores**.

Canal de sindicación oficial:

```text
sindicacion_643
```

Nombre base del feed / paquetes:

```text
licitacionesPerfilesContratanteCompleto3
```

### Fuera de alcance de este `source_code` (por ahora)

Otros datasets oficiales de PLACSP existen y se documentarán / conectarían aparte si el roadmap lo pide:

- licitaciones recibidas por **agregación de CCAA** (perfiles no alojados en PLACSP);
- **contratos menores**;
- catálogo de **perfiles de contratante**.

No mezclar esos paquetes en el mismo conector sin decisión explícita.

---

## 3. Mecanismo de acceso (orden de preferencia del proyecto)

| Preferencia | ¿Aplica? | Detalle |
|---|---|---|
| 1. API oficial de consulta pública | No para este dataset | Los servicios web B2B son para órganos de contratación, no para reutilización abierta masiva |
| 2. Open Data oficial | Sí | Portal de datos abiertos de Hacienda / PLACSP |
| 3. Feeds / XML oficiales | Sí — **mecanismo elegido** | Atom Syndication + payload CODICE |
| 4. Descarga de fichero oficial | Sí | ZIP anuales / mensuales en URI conocida |
| 5. Scraping | No | No necesario |

**Decisión de acceso para EfiLicit:** descarga HTTP de paquetes ZIP (y/o ficheros `.atom` encadenados) desde las URI oficiales de `sindicacion_643`. Sin autenticación para datos abiertos. Sin scraping HTML.

---

## 4. Formato

| Aspecto | Detalle |
|---|---|
| Contenedor | ZIP con uno o varios ficheros `.atom` |
| Transporte | Atom Syndication Format ([RFC 4287](https://www.ietf.org/rfc/rfc4287.html)) |
| Semántica de expediente | CODICE (extensiones PLACSP / PLACE) embebidas en cada `entry` |
| Versión de referencia observada | CODICE ~2.07 (listas de códigos y mapeos en la especificación de sindicación) |
| Encoding | XML UTF-8 (según ficheros publicados) |
| Paginación | Máximo **500** `entry` por fichero; continuación vía `atom:link` con `rel="next"` |

Especificación oficial del formato:

- https://contrataciondelsectorpublico.gob.es/datosabiertos/especificacion-sindicacion.pdf  
  (versión documentada en portal: 1.10, 2024-09-17)

Cada `entry` representa un expediente (o su actualización) y suele incluir un bloque `ContractFolderStatus` con los datos estructurados (estado, expediente, órgano, importes, CPV, etc.).

---

## 5. URLs de descarga (URI bien conocidas)

Base:

```text
https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/
```

### Año en curso (paquetes mensuales + incremental anual)

Patrón oficial (Hacienda):

```text
licitacionesPerfilesContratanteCompleto3_AAAAMM.zip
```

Ejemplo:

```text
https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3_202609.zip
```

El paquete del mes actual refleja actualizaciones hasta el **día previo**.

También existe un archivo **anual incremental** del año en curso (listado en la ficha de Hacienda).

### Años cerrados (histórico)

Paquetes anuales desde **2012** hasta el año anterior, listados en la misma ficha de datos abiertos. Patrón habitual observado:

```text
licitacionesPerfilesContratanteCompleto3_AAAA.zip
```

### Cómo leer un ZIP

1. Descomprimir el paquete.
2. Empezar por el fichero base:

   ```text
   licitacionesPerfilesContratanteCompleto3.atom
   ```

3. Seguir los `atom:link rel="next"` hacia ficheros posteriores del mismo paquete.
4. El último fichero de un paquete enlaza con el primero del paquete anterior (cadena histórica).

---

## 6. Frecuencia de actualización

| Ritmo | Comportamiento |
|---|---|
| Diario | Se publican las actualizaciones del **día anterior** |
| Misma licitación, varias veces | Una licitación puede reaparecer en el feed cada vez que cambia |
| Paquetes | Histórico por años; año actual por meses (+ incremental anual) |

Implicación para el conector: el feed es de **eventos/actualizaciones**, no un dump “una fila = una licitación definitiva”. El upsert canónico debe ser idempotente por identidad de fuente.

---

## 7. Identificadores útiles

| Señal | Origen típico | Uso en EfiLicit |
|---|---|---|
| `atom:id` / id de entry | Atom | Identidad de la entrada/publicación en el feed |
| `ContractFolderID` | CODICE | Número de expediente en la fuente |
| NIF/CIF del órgano | CODICE (`LocatedContractingParty` / órgano) | Señal primaria de identidad de organismo cuando exista |
| DIR3 / id de plataforma | CODICE | Señal auxiliar de organismo |
| URL del expediente en PLACSP | `atom:link` | `source_url` / trazabilidad humana |
| CPV | CODICE | Clasificación |
| NUTS / lugar de ejecución | CODICE | Geografía |

**Regla ya fijada:** nunca usar solo el nombre del organismo como identidad única. Registrar `identity_confidence` cuando falte NIF/CIF.

Para el upsert de Semana 2, la clave canónica de fuente es:

```text
source_code = placsp
source_tender_id = <identificador estable del expediente en PLACSP>
```

**Decisión (Paso 5 — parse):** `source_record_id` / futuro `source_tender_id`:

```text
{tax_id|platform_id}:{ContractFolderID}
```

cuando exista identificador de órgano (NIF/CIF preferente; si no, id de plataforma).  
Si no hay órgano identificable → solo `ContractFolderID`.  
Si tampoco hay expediente → `atom:id` (último recurso).  
Entradas sin ninguna de estas señales se **omiten** (no se inventa identidad).

---

## 8. Límites / rate limits / condiciones

| Tema | Observación |
|---|---|
| Autenticación | No requerida para sindicación de datos abiertos |
| Rate limit publicado | No hay un límite numérico explícito en la ficha consultada |
| Tamaño | ZIPs anuales / mensuales pueden ser grandes; el conector debe controlar timeouts y tamaño de descarga |
| Cortesía | Descargas batch razonables; reintentos con backoff; no martillar el origen |
| TLS / dominio | Usar HTTPS; respetar redirecciones del dominio oficial |

---

## 9. Método incremental (cómo sincronizaremos)

Estrategia prevista (alineada con la fuente, detalle de implementación en Pasos 2–8):

1. **Descubrimiento (`discover`):** localizar el/los paquetes o ficheros `.atom` pendientes (mes actual / día, o rango configurado).
2. **Descarga (`fetch`):** obtener bytes; checksum SHA-256; control de tamaño/timeout/retry.
3. **RAW:** guardar el artefacto inmutable en Storage `raw/placsp/AAAA/MM/DD/...`.
4. **Parseo:** cada `entry` → `SourceRecord` (sin contaminar el modelo canónico con nombres CODICE crudos en tablas).
5. **Upsert:** por `(source_code, source_tender_id)`; reejecutar no duplica.
6. **Checkpoint:** cursor en `source_sync` (p. ej. último paquete/`artifact_key` procesado).

No reprocesar todo el histórico cada día si el cursor/paquetes permiten avanzar solo lo nuevo.

---

## 10. Cobertura

| Aspecto | Detalle |
|---|---|
| Ámbito | Órganos con perfil de contratante **alojado en PLACSP** |
| Exclusiones de este dataset | Contratos menores; (este canal) no es el de agregación CCAA |
| Periodo | Actualizaciones desde ~2012 (cobertura por entidad no homogénea: entidades se han ido sumando) |
| Territorial | Nacional vía perfiles alojados; CCAA con plataforma propia pueden no estar completas aquí (usan agregación u otras fuentes) |

Definición de cobertura del MVP del proyecto: ver `docs/04-roadmap-mvp.md`. Esta ficha no garantiza el 100 % de todos los contratos locales de España.

---

## 11. Fuente alternativa / respaldo

| Recurso | Rol |
|---|---|
| Misma sindicación vía listados de Hacienda | Misma fuente, otro portal de descubrimiento |
| OpenPLACSP (herramienta oficial XLSX) | Útil para humanos / QA; **no** es el pipeline de EfiLicit |
| [contratacionabierta.com](https://contratacionabierta.com/fuentes/placsp-licitaciones/) | Catálogo de referencia; no sustituye la URI oficial |
| Agregación CCAA / menores / otras fuentes | Cobertura complementaria en semanas posteriores |

---

## 12. Observaciones para el conector (Semana 2)

- Stack aprobado: `httpx` + `lxml` + `tenacity` + Pydantic; RAW en Supabase Storage; estado en `source_sync` / `source_artifacts`.
- No modelar todo CODICE: solo campos necesarios para el modelo canónico / MVP.
- Tests con fixtures `.atom` (o fragmentos) controlados; no depender de red en unit tests.
- `source_code` estable: `placsp`.

### Campos canónicos prioritarios a mapear (MVP)

- título / objeto;
- estado;
- fechas (publicación, plazo oferta cuando exista);
- importes + moneda;
- CPV principal;
- tipo de contrato / procedimiento (si vienen claros);
- organismo (nombre + NIF/CIF cuando exista);
- enlace a la ficha en PLACSP;
- trazabilidad al artefacto RAW.

---

## 13. Referencias

1. Ficha datos abiertos Hacienda — licitaciones perfiles contratante (sin menores):  
   https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesContratante.aspx
2. Portal datos abiertos PLACSP:  
   https://contrataciondelsectorpublico.gob.es/wps/portal/DatosAbiertos
3. Especificación de sindicación (PDF):  
   https://contrataciondelsectorpublico.gob.es/datosabiertos/especificacion-sindicacion.pdf
4. Arquitectura fija — contrato de conectores y fuente oficial primero: `docs/01-arquitectura-fija.md`
5. Roadmap Semana 2: `docs/04-roadmap-mvp.md`
6. Plan de ejecución: `docs/plans/semana02-plan.md`
