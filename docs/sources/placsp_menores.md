# PLACSP — Contratos menores (perfiles alojados)

> **source_code:** `placsp_menores`  
> **Estado en el proyecto:** Semana 4 — leftover estatal completo (Pasos 2.1–2.4)  
> **Última revisión de esta ficha:** 2026-09-17  
> **Scraping:** no (existe feed / descarga oficial)  
> **Adaptador previsto:** PLACSP-reuse (Atom/CODICE; parametrizar conector Semana 2)

---

## 1. Organismo / fuente

| Campo | Valor |
|---|---|
| Nombre corto | PLACSP (contratos menores) |
| Nombre completo | Contratos menores publicados en los perfiles del contratante ubicados en la Plataforma de Contratación del Sector Público |
| Organismo responsable | Ministerio de Hacienda — Dirección General del Patrimonio del Estado (Subdirección General de Coordinación de la Contratación Electrónica) |
| Portal | https://contrataciondelsectorpublico.gob.es/ |
| Datos abiertos (portal PLACSP) | https://contrataciondelsectorpublico.gob.es/wps/portal/DatosAbiertos |
| Ficha de datos abiertos (Hacienda) | https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/ContratosMenores.aspx |

Alias histórico del dominio: `contrataciondelestado.es`. Preferir `contrataciondelsectorpublico.gob.es` en URLs nuevas.

---

## 2. Qué dataset usamos

**Conjunto objetivo:**

> Contratos **menores** publicados por los órganos de contratación que tienen su **perfil del contratante alojado en PLACSP**.

Canal de sindicación oficial:

```text
sindicacion_1143
```

Nombre base del feed / paquetes:

```text
contratosMenoresPerfilesContratantes
```

### Relación con otros `source_code` PLACSP

| `source_code` | Dataset | Mezclar aquí |
|---|---|---|
| `placsp` | Perfiles alojados, **sin** menores (`sindicacion_643`) | No |
| `placsp_agregadas` | Agregación CCAA/entes, sin menores (`sindicacion_1044`) | No |
| `placsp_menores` | Este dataset (`sindicacion_1143`) | — |

No mezclar paquetes de distintas sindicaciones en el mismo `source_code`.

**Importante:** este dataset **no** cubre contratos menores de entidades que publican solo por agregación (eso no está en `sindicacion_1044` ni en esta sindicación).

---

## 3. Mecanismo de acceso (orden de preferencia del proyecto)

| Preferencia | ¿Aplica? | Detalle |
|---|---|---|
| 1. API oficial de consulta pública | No para este dataset | Misma lógica que `placsp`: B2B no es reutilización abierta masiva |
| 2. Open Data oficial | Sí | Hacienda / portal PLACSP |
| 3. Feeds / XML oficiales | Sí — **mecanismo elegido** | Atom Syndication + payload CODICE |
| 4. Descarga de fichero oficial | Sí | ZIP anuales / mensuales en URI conocida |
| 5. Scraping | No | No necesario |

**Decisión de acceso para EfiLicit:** descarga HTTP de paquetes ZIP (y/o ficheros `.atom`) desde las URI oficiales de `sindicacion_1143`. Sin autenticación para datos abiertos. Sin scraping HTML.

Para el conector batch preferimos el mismo patrón que Semanas 2–3: **ZIP mensuales** por URI conocida (más estable para `artifact_key` y RAW).

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

Cada `entry` representa un contrato menor (o su actualización). La semántica es compatible con el parser Atom/CODICE de Semana 2; el conector debe usar **`source_code = placsp_menores`** y las URLs/nombres de este dataset.

---

## 5. URLs de descarga (URI bien conocidas)

Base:

```text
https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1143/
```

### Año en curso (paquetes mensuales)

Patrón oficial (Hacienda):

```text
contratosMenoresPerfilesContratantes_AAAAMM.zip
```

Ejemplo:

```text
https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1143/contratosMenoresPerfilesContratantes_202609.zip
```

El paquete del mes actual refleja actualizaciones hasta el **día previo**.

### Años cerrados (histórico)

Paquetes anuales desde **2018** hasta el año anterior, listados en la ficha de Hacienda. Patrón habitual:

```text
contratosMenoresPerfilesContratantes_AAAA.zip
```

### Cómo leer un ZIP

1. Descomprimir el paquete.
2. Empezar por el fichero base:

   ```text
   contratosMenoresPerfilesContratantes.atom
   ```

3. Seguir los `atom:link rel="next"` hacia ficheros posteriores del mismo paquete.
4. El último fichero de un paquete enlaza con el primero del paquete anterior (cadena histórica).

---

## 6. Frecuencia de actualización

| Ritmo | Comportamiento |
|---|---|
| Diario | Se publican las actualizaciones del **día anterior** |
| Misma entrada, varias veces | Un contrato puede reaparecer en el feed cada vez que cambia |
| Paquetes | Histórico por años desde 2018; año actual por meses |

Implicación: feed de **eventos/actualizaciones**; upsert idempotente por `(source_code, source_tender_id)`.

---

## 7. Identificadores útiles

| Señal | Origen típico | Uso en EfiLicit |
|---|---|---|
| `atom:id` / id de entry | Atom | Identidad de la entrada/publicación en el feed |
| `ContractFolderID` | CODICE | Número de expediente en la fuente |
| NIF/CIF del órgano | CODICE | Señal primaria de identidad de organismo cuando exista |
| DIR3 / id de plataforma | CODICE | Señal auxiliar de organismo |
| URL del expediente | `atom:link` | `source_url` / trazabilidad humana |
| CPV | CODICE | Clasificación (puede faltar con más frecuencia que en licitaciones “mayores”) |
| NUTS / lugar de ejecución | CODICE | Geografía |

**Regla ya fijada:** nunca usar solo el nombre del organismo como identidad única.

Clave canónica de fuente:

```text
source_code = placsp_menores
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

**Varias versions del mismo expediente en un ZIP/Atom:** mismo criterio que [placsp.md](placsp.md) (parser compartido): gana el `atom:updated` más reciente.

---

## 8. Límites / rate limits / condiciones

| Tema | Observación |
|---|---|
| Autenticación | No requerida para sindicación de datos abiertos |
| Rate limit publicado | No hay un límite numérico explícito en la ficha consultada |
| Tamaño | Volumen alto (órdenes de magnitud mayores que perfiles/agregadas); timeouts + `max_bytes` generosos y ventanas acotadas en live |
| Cortesía | Descargas batch razonables; reintentos con backoff |
| TLS / dominio | HTTPS; respetar redirecciones del dominio oficial |
| Condiciones de uso | Aviso legal Hacienda: https://www.hacienda.gob.es/es-ES/Paginas/Avisolegal.aspx |

---

## 9. Método incremental

Misma estrategia que `placsp` / `placsp_agregadas`, con prefijo RAW distinto:

1. **`discover`:** paquetes mensuales pendientes (`artifact_key` = nombre del ZIP).
2. **`fetch`:** bytes + SHA-256 + timeout/retry/`max_bytes`.
3. **RAW:** `raw/placsp_menores/AAAA/MM/DD/...` en Storage.
4. **Parseo:** Atom/CODICE → `SourceRecord` (reutilizar parser; no contaminar DDL canónico).
5. **Upsert:** `(placsp_menores, source_tender_id)`.
6. **Checkpoint:** cursor en `source_sync` por este `source_code`.

---

## 10. Cobertura

| Aspecto | Detalle |
|---|---|
| Ámbito | Contratos menores de órganos con perfil **alojado en PLACSP** |
| Exclusiones | Licitaciones no-menores (`placsp`); agregación (`placsp_agregadas`); menores de plataformas solo-agregadas |
| Periodo | Desde **2018** (según ficha Hacienda) |
| Territorial | Nacional sobre perfiles alojados (incl. CCAA sin plataforma propia — [cobertura-ccaa.md](cobertura-ccaa.md)); no cubre menores de plataformas solo-agregadas |

Pedido explícito del corte MVP (`docs/04`): contratos menores cuando estén disponibles en la fuente integrada.

---

## 11. Fuente alternativa / respaldo

| Recurso | Rol |
|---|---|
| Ficha Hacienda / listados ZIP | Descubrimiento oficial de paquetes |
| OpenPLACSP | QA humana; no es el pipeline |
| [contratacionabierta.com](https://contratacionabierta.com/) | Catálogo de referencia; no sustituye URI oficial |
| `placsp` / `placsp_agregadas` | Conjuntos hermanos; no mezclar en este `source_code` |

---

## 12. Observaciones para el conector (Semana 4)

- **Reutilizar** el conector PLACSP parametrizando `PlacspSyndication` — no clonar el parser.
- **Discover + fetch:** `PlacspConnector(syndication=PLACSP_MENORES)`; `fetch` reutiliza `download_bytes`. Tests con `fetch_transport` inyectado — **sin red en unit tests**.
- **RAW:** `fetch_validate_and_store_raw` + `validate_artifact` (magic ZIP) → Storage `raw/placsp_menores/...` + `source_artifacts`.
- **Parse:** reutilizar `parse_placsp_artifact`; ZIP base `contratosMenoresPerfilesContratantes.atom`.
- **Normalize + identidad:** reutilizar etapas del pipeline común.
- **Upsert:** unique `(placsp_menores, source_tender_id)`; `source_sync` con contadores.
- **CLI:** `run-placsp --syndication placsp_menores --fixture … --dry-run`.
- **Workflow:** extender `ingest-placsp.yml` con opción `placsp_menores`; dry-run default; cron off.
- Stack aprobado: `httpx` + `lxml` + `tenacity` + Pydantic; RAW en Supabase Storage.
- Fixtures Atom/ZIP propios o reutilizados etiquetados con este `source_code`.
- Tests unitarios sin red.
- En live: empezar con **ventana acotada** (1 mes) por el volumen del dataset.

### Campos canónicos prioritarios (MVP)

Igual que `placsp`: título/objeto, estado, fechas, importes, CPV (si viene), tipo/procedimiento, organismo (NIF/CIF cuando exista), URL, trazabilidad RAW.

---

## 13. Referencias

1. Ficha datos abiertos Hacienda — contratos menores:  
   https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/ContratosMenores.aspx
2. Especificación de sindicación (PDF):  
   https://contrataciondelsectorpublico.gob.es/datosabiertos/especificacion-sindicacion.pdf
3. Fichas hermanas: [placsp.md](placsp.md) · [placsp_agregadas.md](placsp_agregadas.md)
4. Cobertura CCAA: [cobertura-ccaa.md](cobertura-ccaa.md)
5. Plan Semana 4: [docs/plans/semana04-plan.md](../plans/semana04-plan.md)
6. Arquitectura fija — conectores y fuente oficial primero: `docs/01-arquitectura-fija.md`
