# Investigación 1: base de datos de Supabase casi llena (0,45 de 0,50 GB)

Fecha: 6 de noviembre de 2026. Proyecto Supabase `luvxqyajujlznocflymo` (eu-west-1, Irlanda), plan Free.
Código revisado: rama `tecnico4/mis-licitaciones`, que es la que ejecutan las ingestas. Logs revisados: todas las ejecuciones de GitHub Actions desde el 1 de septiembre (están en `datos/`).
Cifras de producción: consultas del Anexo A, ejecutadas el 6-nov por la tarde. Las ingestas han seguido corriendo desde entonces, así que conviene repetirlas antes de actuar.

---

## Resumen

1. **La mitad de la base de datos son ficheros huérfanos.** Hay 97.356 ficheros en Storage (2,37 GB) sin fila en `source_artifacts`. Son restos de ejecuciones canceladas o fallidas. Sus filas en `storage.objects` ocupan ~180 MB de los 415 MB.
2. **Storage está a 2,7 veces el límite Free:** 2,74 GB frente a 1 GB. Probablemente ya corre el periodo de gracia.
3. **La causa de fondo es guardar el RAW entrada a entrada (ADR 022 y 025).** Cada licitación nueva o modificada genera:
   - un fichero en Storage (~30 KB);
   - una fila en `storage.objects` (~1,9 KB);
   - una fila en `source_artifacts` (~2,2 KB).

   Con unas 6.000 al día, aunque se limpien los huérfanos, la base de datos vuelve a llenarse en menos de una semana.
4. **Al superar los 500 MB la base de datos no pasa a solo lectura en el acto.** Primero llega un aviso y un periodo de gracia. Después, **todas las peticiones a la API devuelven HTTP 402** y la web deja de funcionar.
5. **Se puede resolver a 0 €**, con tres cosas:
   - limpiar los huérfanos;
   - guardar el RAW **por página `.atom` comprimida** en lugar de por entrada, quedándose solo 1–2 meses en Supabase;
   - **una política de retención de licitaciones** o quitar los contratos menores. Las licitaciones en sí (~3,6 KB cada una) llenan el plan Free en 1,5–3 meses.

---

## 0. Datos reales de producción (6-nov, tarde)

**Base de datos: 415 MB** (`pg_database_size`). El panel muestra 0,45 GB porque mide la media del ciclo y otros conceptos.

| Tabla | Total | Filas | Por fila | Comentario |
|---|---|---|---|---|
| `storage.objects` | **217 MB** (52 %) | 105–115k | ~1,9 KB | **84 % son huérfanos** |
| `tenders` | 72 MB | 38.730 | 1,9 KB | 36 MB son índices |
| `source_artifacts` | 40 MB | 18.066 | 2,2 KB | 31 MB son índices (dos `unique` sobre textos largos) |
| `tender_sources` | 21 MB | 41.588 | 0,5 KB | |
| `documents` | 20 MB | 39.448 | 0,5 KB | |
| `tender_events` | 12 MB | 41.086 | 0,3 KB | |
| `contracting_authorities` + `tender_cpvs` | 15 MB | | | |
| **Licitaciones (canónico) en total** | **~150 MB** | 38.730 | **~3,6 KB por licitación** | |

**Storage (bucket `raw`): 2,74 GB, frente a 1 GB del plan Free.**

| Fuente | Ficheros | Tamaño |
|---|---|---|
| placsp | 70.863 | 2.089 MB |
| placsp_menores | 37.558 | 438 MB |
| catalunya | 941 | 111 MB |
| placsp_agregadas | 5.460 | 97 MB |
| euskadi | 600 | 4 MB |

**Huérfanos: 97.356 ficheros, 2.372 MB.** Los ficheros que no son huérfanos (115.422 − 97.356 = **18.066**) coinciden exactamente con las filas de `source_artifacts`. Todo lo que no tiene fila en `source_artifacts` es basura de ejecuciones canceladas o fallidas.

**Conclusiones:**
1. **Los huérfanos son el problema más grande y el más fácil de quitar.**
   - Ocupan **~180 MB de base de datos** (84 % de `storage.objects`) y **2,37 GB de Storage**.
   - Borrarlos deja Storage en **~0,37 GB**, y la base de datos en **~235 MB** tras el `VACUUM`.
2. **Con el diseño actual, cada licitación nueva cuesta ~7,7 KB aunque se limpie.** Son 3,6 KB canónicos más ~4,1 KB entre `storage.objects` y `source_artifacts`.
   - A ~5.000 al día (ritmo de noviembre) son **~40 MB/día**, así que los ~265 MB libres duran **menos de una semana**.
   - Pasar a RAW por página es imprescindible, no opcional.
3. **A medio plazo lo que pesa es el canónico, ~3,6 KB por licitación.**
   - El plan Free da para unas **~100–120k licitaciones** en total.
   - El ritmo de noviembre está inflado por el arranque de mes: las licitaciones que se actualizan y no estaban en la base de datos cuentan como nuevas.
   - A ritmo estable, con todas las fuentes, la estimación es de **~2.000–3.500 al día** (~7–12 MB/día). Hay que confirmarlo midiendo una semana tras el arreglo.
   - Eso da **1,5–3 meses de histórico completo**. **Para seguir a 0 € hace falta retención (F) o quitar los contratos menores (D).**

---

## 1. Por qué se llena

### 1.1 Lo que hace el código

Para cada `atom:entry` nueva del ZIP mensual, `ingestion/src/efilicit_ingestion/pipeline/placsp_incremental.py` (ADR 022):
1. consulta `source_artifacts` por checksum;
2. sube el XML a Storage (`raw/placsp/AAAA/MM/DD/entries/{sha256}.atom.xml`);
3. inserta una fila en `source_artifacts`.

Supabase añade por su cuenta una fila en `storage.objects` por cada fichero. Catalunya y Euskadi siguen el mismo patrón por fila (ADR 025, `connectors/socrata/expand_rows.py` → `rows/{sha256}.json`).

La **descarga** ya va por páginas en las tres fuentes:
- PLACSP: ficheros `.atom` de hasta ~500 entradas;
- Socrata: `$limit` / `$offset`;
- Euskadi: `currentPage`.

Lo que no va por páginas es lo que se **guarda**: el código trocea cada página antes de subirla. Hasta la rama `semana-06`, Catalunya y Euskadi guardaban la página entera. Lo muestran los logs:
- 2-nov: 10 ficheros para 8.007 licitaciones;
- 5-nov, ya con ADR 025: 900 ficheros para 899.

**Coste medido en local el 29-oct (carga real de julio, solo perfiles):**

| Concepto | Por entrada | Julio (59.878 entradas) |
|---|---|---|
| `storage.objects` (tabla + índices) | ~2 KB | 114 MB |
| `source_artifacts` | ~0,9 KB | 51 MB |
| Fichero en Storage | ~30 KB | 1.888 MB |
| Mismo mes guardado **por página `.atom` en gzip** | — | **~120 ficheros, ~180 MB** |

La página `.atom` más grande mide 21,8 MB sin comprimir y 1,85 MB en gzip. La premisa del ADR 022 (">50 MB por página") no se cumple.

### 1.2 Ficheros subidos por día (logs, ejecuciones correctas; `artifacts=` es el nº de ficheros)

| Día | perfiles | menores | agregadas | Catalunya | Euskadi | Total |
|---|---|---|---|---|---|---|
| 02-nov | 458 | 524 | 350 | 10 | 10 | ~1.350 |
| 04-nov | 3.997 | *falló* | *falló* | 4 | 10 | ~4.000 (+ huérfanos de los fallos) |
| 05-nov | 0 | 3.022 | 1.929 | 910 | 10 | ~5.870 |
| 06-nov | 3.113 | 1.980 | 1.249 | 0 | 530 | ~6.870 |

Antes del 2-nov se subía un fichero por ejecución. El cambio a uno por entrada llegó con `mis-licitaciones`.

### 1.3 De dónde salen los huérfanos

- La subida a Storage es una petición HTTP aparte; no forma parte de la transacción de Postgres.
- El pipeline hace un único `commit` al final del ZIP entero (`run_pipeline_placsp_incremental_postgres`). Si la ejecución falla o la corta el límite de 6 h, `source_artifacts` vuelve atrás, pero **el fichero y su fila en `storage.objects` se quedan**.
- La ruta lleva la fecha (`pipeline/paths.py`). La ejecución del día siguiente vuelve a subir lo mismo con otro nombre.
- Desde octubre hay **1.970 minutos de ejecuciones canceladas y 305 de fallidas**, varias de 6 h subiendo a ~3 ficheros/s. Después del 6-nov hubo dos fallos más (7 y 8-nov, `placsp_menores`).

### 1.4 Qué pasa al llegar al límite (documentación de Supabase)

- **Los 500 MB son una cuota del plan, medida como media diaria del ciclo de facturación.** Si se supera, llega un aviso y un periodo de gracia, y luego **la API responde 402 a todo**. Se levanta al bajar del límite o al empezar el ciclo siguiente.
- **El disco del plan Free es de 2 GB.** Al 95 % la base de datos pasa a solo lectura; si se llena del todo, Postgres se apaga.
- **Qué mide "Database size":** datos, índices y espacio muerto (*bloat*). Borrar filas no reduce el tamaño hasta hacer `VACUUM FULL` o `pg_repack`. Con un `VACUUM` normal, el espacio se reutiliza para filas nuevas, pero el tamaño no baja.
- **Los bytes de Storage no cuentan como base de datos**, pero sus filas en `storage.objects` sí.
- **Supabase no permite borrar ficheros con `DELETE` sobre `storage.objects`.** Hay que hacerlo por la API de Storage.
- Fuentes: https://supabase.com/docs/guides/platform/database-size , https://supabase.com/docs/guides/platform/billing-faq

---

## 2. Alternativas estudiadas

| # | Alternativa | Qué ahorra | Coste | Esfuerzo | Riesgos / pegas |
|---|---|---|---|---|---|
| A | **RAW por página `.atom` en gzip** en vez de por entrada. Clave `raw/placsp/pages/{sha256}.atom.gz` sin fecha, una fila de `source_artifacts` por página. | Metadatos RAW: de ~60.000 filas/mes por sindicación a ~120. Storage: julio pasa de 1.888 MB a ~180 MB. | 0 € | 1,5–2 días | La trazabilidad pasa a (sha256 de la página + `entry/id` + `updated`). Necesita un ADR que sustituya al 022. |
| B | **Retención del RAW:** en Supabase, solo el mes en curso y el anterior. | Storage estable (<~700 MB en el peor caso). | 0 € | 0,5 días (job mensual) | Hacienda sigue publicando los ZIP de meses y años pasados; el repo ya construye URLs de ZIP anuales (`connectors/placsp/urls.py`). *Verificar con un mes cerrado que el ZIP final contiene todas las versiones.* |
| C | **Limpiar los huérfanos** y hacer `VACUUM`. | ~180 MB de base de datos y 2,37 GB de Storage. | 0 € | 1–2 h | Revisar el listado antes de borrar. `VACUUM FULL` en `storage.objects` puede no estar permitido; en ese caso el espacio se reutiliza, pero el tamaño no baja. |
| D | **Contratos menores (sindicación 1143): ¿hacen falta?** | Es la sindicación de más volumen. Quitarla o filtrarla (solo CPV de Eficen, o solo X días) haría crecer la base de datos ~30–40 % menos (estimación). | 0 € | 0,5 días | Decisión de producto. Los contratos menores se publican normalmente ya adjudicados (art. 63.4 LCSP); para encontrar licitaciones a las que presentarse suelen aportar poco. |
| E | **Quitar el índice trigram de títulos** y sustituirlo por un diccionario de palabras. | ~19 % del tamaño de `tenders`. Las búsquedas pasan de ~1,5 s a <70 ms. | 0 € | 1–1,5 días | Hay que mantener el diccionario tras cada ingesta. |
| F | **Retención de licitaciones:** borrar o archivar las cerradas hace más de N meses, salvo favoritas, en "Mis licitaciones" o valoradas. | Pone techo al tamaño de la base de datos. | 0 € | 1 día | Decisión de producto: se pierde histórico consultable en la web. |
| G | **Sacar el RAW a almacenamiento externo gratis:** Cloudflare R2 (10 GB) o Backblaze B2 (10 GB). | Storage de Supabase = 0. | 0 € | 1 día | R2 pide tarjeta. Es un servicio más que mantener. Con A + B no hace falta. |
| H | **Otra base de datos gratis** (Neon 1 GB, Aiven 1 GB, Prisma Postgres 2 GB, CockroachDB). | Más espacio. | 0 € | Semanas | **No recomendado.** Hay que rehacer Auth, RLS y RPC. Prisma limita a 200k operaciones/mes. CockroachDB no es Postgres real. |
| I | **Segundo proyecto Supabase Free.** | Nada claro. | 0 € | — | **No recomendado.** No está claro si la cuota es por proyecto o por organización, y partir los datos lo complica todo. |
| J | **Pagar:** proyecto en la organización PRO (~10 $/mes de compute) o un Pro propio (25 $/mes). | 8 GB de base de datos y 100 GB de Storage. | 10–25 $/mes | 10 min | Ahora no es posible. Es la salida si A–F no bastan. |

---

## 3. Recomendación (por orden)

**Paso 0 (sin código):**
- **Pausar en cron-job.org `placsp_menores` y `placsp_agregadas`** hasta tener el paso 2.
- Poner `upload_storage=false` **no sirve**. Con `--no-storage`, `InMemoryArtifactStore` (`pipeline/ports.py`) sigue insertando filas en `source_artifacts` con rutas de ficheros que no existen.

**Paso 1 (el más urgente, 1–2 h): limpiar los huérfanos.**
- Script: `scripts/borrar_huerfanos.py`.
  - Por defecto **solo simula**: saca un resumen por fuente y día, y un CSV.
  - Con `--apply` borra por la API de Storage, en lotes de 1.000, volviendo a comprobar cada lote.
  - Ignora lo subido en las últimas 24 h. **No ejecutarlo mientras corre una ingesta.**
- Después, `vacuum full storage.objects;` en el SQL Editor. Si da error de permisos, `vacuum storage.objects;`.
- Efecto esperado: Storage de 2,74 a ~0,37 GB; base de datos de 415 a ~235 MB (o crecimiento cero mientras se reutiliza el hueco).

**Paso 2 (1,5–2 días): RAW por página gzip (A) + retención de 2 meses (B).**
- Borrar después los ficheros por entrada que ya no hagan falta, junto con sus filas de `source_artifacts`.
- Es el mismo cambio que reduce los minutos de Actions (Investigación 2).

**Paso 3:**
- Contratos menores (D).
- Retención de licitaciones (F). **Necesaria para seguir a 0 € más allá de 1,5–3 meses.**
- Diccionario y quitar el trigram (E).

**Resultado esperado** (estimación; se mide al aplicar cada paso):
- RAW en la base de datos: de ~18 MB/día a prácticamente 0.
- Canónico: ~7–12 MB/día con todas las fuentes, menos sin contratos menores.
- Con F, el tamaño se estabiliza.

## 4. ¿Se puede sin costes?

**Sí, a corto plazo**, con los pasos 0–2: limpieza más RAW por página, unos 2–3 días de desarrollo.

**Más allá de 1,5–3 meses, solo con retención de licitaciones o quitando los contratos menores.** Por ejemplo: abiertas, cerradas hace menos de 3 meses, y las que estén en favoritos o en "Mis licitaciones". Con eso el tamaño se estabiliza y el plan Free aguanta indefinidamente.

Si se quiere todo el histórico de todas las fuentes en la web, el plan Free no da y hay que pagar (J).

---

## Anexo A. Consultas de verificación (solo lectura)

Ejecutarlas **de una en una** en **Supabase → SQL Editor**, que solo muestra el resultado de la última.

```sql
-- 1) Tamaño total
select pg_size_pretty(pg_database_size(current_database())) as bd_total;

-- 2) Las 15 tablas más grandes (datos + índices)
select n.nspname || '.' || c.relname                 as tabla,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total,
       pg_size_pretty(pg_relation_size(c.oid))       as datos,
       pg_size_pretty(pg_indexes_size(c.oid))        as indices,
       c.reltuples::bigint                           as filas_aprox
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog', 'information_schema')
order by pg_total_relation_size(c.oid) desc
limit 15;

-- 3) Storage: ficheros y bytes por bucket y fuente
select bucket_id,
       split_part(name, '/', 1) as fuente,
       count(*)                 as ficheros,
       pg_size_pretty(sum((metadata->>'size')::bigint)) as bytes
from storage.objects
group by 1, 2
order by count(*) desc;

-- 4) Huérfanos: ficheros RAW sin fila en source_artifacts
--    storage_path = 'raw/' || name. Con left join (igualdad simple) va rápido;
--    con NOT EXISTS ... IN (...) hace un bucle anidado (storage_path no tiene índice)
--    y el SQL Editor corta con "Failed to fetch".
select count(*) as huerfanos,
       pg_size_pretty(sum((o.metadata->>'size')::bigint)) as bytes
from storage.objects o
left join public.source_artifacts a
       on a.storage_path = 'raw/' || o.name
where o.bucket_id = 'raw'
  and a.id is null;
```
