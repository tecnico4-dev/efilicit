# EfiLicit: base de datos, Storage y GitHub Actions. Contexto y propuestas

**Fecha:** 6 de noviembre de 2026  
**Estado:** propuesta. **No ejecutar nada sin revisión.** Cada bloque indica el esfuerzo estimado y qué se considera "hecho".
**Detalle y evidencias:** `INVESTIGACION-1-base-de-datos.md`, `INVESTIGACION-2-github-actions.md` y `datos/` en esta misma carpeta.

---

## 1. Contexto

### 1.1 Cómo está montado hoy

- **Web:** Next.js en Vercel.
- **Base de datos, Auth y Storage:** Supabase, proyecto `luvxqyajujlznocflymo`, en **eu-west-1 (Irlanda)**, plan **Free**. Por ahora no se puede mover a la organización PRO.
- **Ingesta:** Python 3.12 (`ingestion/`). Se ejecuta en **GitHub Actions** (`ubuntu-latest`) mediante `workflow_dispatch`, que dispara **cron-job.org** (ADR 020).
- **Fuentes:** PLACSP (sindicaciones 643 perfiles, 1044 agregadas y 1143 menores, a partir del ZIP mensual), Catalunya (Socrata) y Euskadi (REST).
- **Repo:** `tecnico4-dev/efilicit`. Está en la cuenta **personal** de Deiane y ahora es **público**, para no pagar minutos de Actions.
- **Código vigente en producción:** rama `tecnico4/mis-licitaciones`, 76 commits por delante de `main`. Algunos disparos todavía usan `tecnico4/semana-06`.



### 1.2 Límites del plan gratuito (comprobados el 6-nov-2026)


| Servicio                     | Límite Free                                            | Qué pasa al superarlo                                                                                                  |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Supabase, base de datos      | 500 MB (media del ciclo de facturación). Disco de 2 GB | Aviso → periodo de gracia → **la API responde 402 a todo y la web deja de funcionar**. Al 95 % del disco, solo lectura |
| Supabase, Storage            | 1 GB (media del ciclo) y 50 MB por fichero             | Aviso → gracia → restricciones                                                                                         |
| GitHub Actions, repo privado | 12 $/mes ≈ **2.000 min** de Linux                      | Sin tarjeta, **se bloquean las ejecuciones** hasta el mes siguiente                                                    |
| GitHub Actions, repo público | Ilimitado con runners estándar                         | Los logs son públicos durante 90 días                                                                                  |




### 1.3 Situación medida

**Base de datos: 415 MB.**


| Tabla                                     | Tamaño | Filas  |
| ----------------------------------------- | ------ | ------ |
| `storage.objects`                         | 217 MB | ~115k  |
| `tenders`                                 | 72 MB  | 38.730 |
| `source_artifacts`                        | 40 MB  | 18.066 |
| `tender_sources`                          | 21 MB  |        |
| `documents`                               | 20 MB  |        |
| `tender_events`                           | 12 MB  |        |
| `contracting_authorities` + `tender_cpvs` | 15 MB  |        |


El canónico (las licitaciones y sus tablas asociadas) ocupa **~3,6 KB por licitación**.

**Storage (bucket** `raw`**): 2,74 GB, 2,7 veces el límite.**


| Fuente           | Ficheros | Tamaño   |
| ---------------- | -------- | -------- |
| placsp           | 70.863   | 2.089 MB |
| placsp_menores   | 37.558   | 438 MB   |
| catalunya        | 941      | 111 MB   |
| placsp_agregadas | 5.460    | 97 MB    |
| euskadi          | 600      | 4 MB     |


**Huérfanos: 97.356 ficheros (2.372 MB)** sin fila en `source_artifacts`. Los que no son huérfanos son 18.066, exactamente las filas de `source_artifacts`. Suponen **~180 MB de base de datos** (en `storage.objects`) y **el 87 % del Storage**.

**GitHub Actions:**

- Septiembre: 55 min. Octubre: **2.805 min**. Del 2 al 6 de noviembre: **270–365 min al día**, unos 8.000–11.000 al mes.
- Desde octubre, **el 47 % de los minutos se ha ido en ejecuciones canceladas** (varias cortadas a las 6 h) y un 7 % en fallidas.
- Duraciones del 6-nov:


| Sindicación | Licitaciones | Duración | s/licitación |
| ----------- | ------------ | -------- | ------------ |
| perfiles    | 3.113        | 88 min   | 1,7          |
| menores     | 1.980        | 89 min   | 2,7          |
| agregadas   | 1.249        | 61 min   | 2,9          |
| Euskadi     | 500          | 16 min   |              |




### 1.4 Causas raíz

1. **RAW por entrada (ADR 022 y 025).** Cada licitación genera un fichero en Storage (~30 KB), una fila en `storage.objects` (~1,9 KB) y una fila en `source_artifacts` (~2,2 KB). Son ~6.000 ficheros al día.
  - La premisa del ADR 022, que las páginas `.atom` pesan más de 50 MB, es falsa: la mayor mide 21,8 MB sin comprimir y 1,85 MB en gzip.
2. **Huérfanos por diseño.**
  - `placsp_incremental.py` sube cada fichero a Storage dentro del bucle y hace un único `commit` al final del ZIP entero (`run_pipeline_placsp_incremental_postgres`).
  - Si la ejecución falla o la corta el límite de 6 h, la base de datos hace rollback pero **los ficheros se quedan**.
  - La ruta lleva la fecha (`pipeline/paths.py`: `raw/{source}/{yyyy}/{mm}/{dd}/...`), así que la ejecución siguiente vuelve a subir lo mismo con otro nombre.
3. **Escritura fila a fila contra una base de datos remota.**
  - Son ~15 consultas SQL más una subida HTTP por licitación, desde un runner que probablemente está en EE. UU. contra una base de datos en Irlanda.
  - Eso da 1,7–2,9 s por licitación, de ahí los minutos y las cancelaciones.
4. **Se descarga y recorre el ZIP del mes entero cada día** (100–300 MB), aunque solo cambien unas pocas páginas.
5. **No hay política de retención.** Ni del RAW ni de licitaciones antiguas. Con ~3,6 KB por licitación, 500 MB dan para unas **~100–120k licitaciones** en total.
6. **Operación difusa.** Los disparos salen de ramas de trabajo, el repo está en una cuenta personal y no hay alarma de consumo.

---



## 2. Propuestas

Están ordenadas por urgencia. **Coste de todas: 0 €**, salvo la P11, que es la alternativa de pago.

### P0. Medidas operativas inmediatas (sin código)

 **Esfuerzo:** 30 min.

- **Pausar en cron-job.org** `placsp_menores` **y** `placsp_agregadas` hasta que estén P2–P4. La web sigue funcionando con los datos actuales y se frena el crecimiento.
  - **No** sirve poner `upload_storage=false`: con `--no-storage` el código sigue insertando filas en `source_artifacts` con rutas inventadas (`pipeline/ports.py`, `InMemoryArtifactStore`). Ver P9.
- **No poner el repo en privado todavía.** Al ritmo actual, los 2.000 min se acaban en ~6 días y la ingesta se para.
- **Revisar los pendientes de seguridad** que se tratan aparte, fuera de este repo público.
- **No resetear la contraseña de la base de datos.** El secreto `EFILICIT_DATABASE_URL` de GitHub dejaría de funcionar.

**Hecho cuando:** solo quedan activas en el cron las ingestas de perfiles, Catalunya y Euskadi, y se han revisado los pendientes de seguridad.

### P1. Limpiar los huérfanos

**Esfuerzo:** 1–2 h. Antes de borrar, revisar el CSV de la simulación.

- Hay un script preparado: `scripts/borrar_huerfanos.py`.
  - Por defecto **solo simula** y genera un CSV para revisar.
  - Con `--apply` borra mediante la API de Storage, en lotes de 1.000, volviendo a comprobar cada lote contra `source_artifacts`.
  - Ignora lo subido en las últimas 24 h.
  - **Se ejecuta con todas las ingestas paradas.**
- Supabase no permite borrar ficheros con `DELETE` sobre `storage.objects`. Si se borrara solo la fila, el fichero seguiría ocupando espacio.
- Después: `vacuum full storage.objects;`. Si da error de permisos, `vacuum storage.objects;`: el tamaño no baja, pero el espacio se reutiliza.
- Alternativa a ejecutarlo en local: un workflow manual `cleanup-orphans.yml` (simulación por defecto) que usa los secretos que el repo ya tiene.

**Hecho cuando:** la consulta de huérfanos del Anexo A devuelve ~0, Storage está por debajo de 0,5 GB y la base de datos ronda los 235 MB (o deja de crecer mientras reutiliza el hueco).

### P2. Que no se generen más huérfanos (orden y transacciones)

**Esfuerzo:** 0,5 días. Va en la misma PR que P3.

- **Commit por página** (o por lote de N entradas), no por ZIP entero. Así una cancelación conserva lo ya hecho y la siguiente ejecución continúa donde se quedó.
- **Clave de Storage sin fecha y basada en el contenido** (`raw/{source}/pages/{sha256}.atom.gz`). Si ya existe, no se vuelve a subir.
- **Orden fijo:** primero se sube a Storage y después se escribe en la base de datos, en la misma unidad de commit. Si falla lo segundo, la siguiente ejecución reutiliza el fichero, porque la clave es el sha256.
- **Poner** `timeout-minutes` **en los workflows** (por ejemplo 60) para que un atasco no consuma 6 h.

**Hecho cuando:** tras cancelar a mano una ejecución a mitad, la consulta de huérfanos sigue en ~0 y la siguiente ejecución no repite el trabajo ya confirmado.

### P3. RAW por página `.atom` en gzip (sustituye al ADR 022)

**Esfuerzo:** 1–1,5 días, con un ADR nuevo.

> **Aclaración:** la **descarga** ya va por páginas en las tres fuentes:
>
> - PLACSP: el ZIP trae ficheros `.atom` de hasta ~500 entradas;
> - Catalunya: `$limit` / `$offset` de Socrata;
> - Euskadi: `currentPage`.
>
> Lo que **no** va por páginas es lo que se **guarda en el bucket**. El código **trocea cada página en entradas o filas** y sube un fichero por cada una:
>
> - `connectors/placsp/expand_entries.py` → `entries/{sha256}.atom.xml`;
> - `connectors/socrata/expand_rows.py` → `rows/{sha256}.json`.
>
> Hasta la rama `semana-06`, Catalunya y Euskadi sí guardaban la página entera. Lo muestran los logs del 2-nov: Catalunya, 10 ficheros para 8.007 licitaciones. Con ADR 025 en `mis-licitaciones` se pasó a un fichero por fila (5-nov: 900 ficheros para 899). Esta propuesta consiste en **guardar la misma página que ya se descarga**, comprimida y sin trocearla.

- Un objeto por página `.atom` del ZIP, comprimido en gzip. El sha256 se calcula sobre el contenido **sin comprimir** y hay una fila de `source_artifacts` por página.
- **Trazabilidad:** cada versión de una licitación queda ligada a (sha256 de la página, `entry/id`, `updated`). El historial sigue en `tender_events`.
- **Saltar páginas ya vistas:** si el sha256 de la página ya existe, no se parsea. Hoy se hashean todas las entradas cada día.
- **Mismo patrón para Catalunya y Euskadi (ADR 025):** un objeto por página de API o por lote, no por fila.
- **Cifras de julio (perfiles, medidas):** de 59.878 ficheros y 1.888 MB pasaría a **~120 ficheros y ~180 MB**. Los metadatos RAW en la base de datos pasan de ~18 MB/día a prácticamente 0.
- **Opcional, en un segundo paso:** leer el **feed vivo** de PLACSP (`sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom`, siguiendo `rel="next"` hasta el cursor) en vez del ZIP mensual, y reconciliar con el ZIP una vez al mes. Se descargan unos MB al día en lugar de 100–300 MB.
  - Observado el 30-oct: la cabecera del feed parece publicarse una vez al día, hacia las 19:15 GMT. Conviene medirlo durante 7 días antes de depender de ello.
- Después de desplegar, borrar con un script los ficheros por entrada que ya no sirvan y sus filas de `source_artifacts`, o dejarlos caducar con P5.

**Hecho cuando:** una ejecución diaria de cada sindicación sube como mucho unas decenas de objetos, y `storage.objects` y `source_artifacts` crecen menos de 1 MB al día.

### P4. Escrituras por lotes (reduce los minutos de Actions)

**Esfuerzo:** 1–1,5 días.

- Sustituir el *upsert* fila a fila de `pipeline/canonical_repo.py` (~14 SQL por licitación) por escrituras por página: `executemany`, o `COPY` a una tabla temporal + `INSERT … ON CONFLICT … DO UPDATE`.
  - Afecta a `contracting_authorities`, `tenders`, `tender_sources`, `tender_cpvs`, `tender_events` y `documents`.
- Buscar los checksums conocidos **en bloque** (`where checksum = any(%s)`), no uno por entrada.
- Un único cliente HTTP por ejecución para descargas y subidas.
- **Medir** minutos por sindicación antes y después, y apuntarlo en la PR.

**Hecho cuando:** cada sindicación tarda **<10 min/día** y el total de Actions queda en **<1.500 min/mes**. Objetivo: 300–600.

### P5. Retención del RAW

**Esfuerzo:** 0,5 días.

- En Supabase, solo el **mes en curso y el anterior**. Un job mensual borra lo anterior, por la API de Storage, junto con sus filas de `source_artifacts`.
- **Justificación:** Hacienda sigue publicando los ZIP de meses y años cerrados; el repo ya construye URLs de ZIP anuales (`connectors/placsp/urls.py`). El RAW antiguo se puede volver a descargar del origen.
  - **Antes de activarlo**, comprobar con un mes cerrado que su ZIP contiene todas las versiones de cada entrada.
- Si se quisiera conservar todo el RAW: Cloudflare R2 (10 GB gratis, pide tarjeta) o Backblaze B2 (10 GB gratis).

**Hecho cuando:** el Storage se mantiene estable por debajo de ~0,7 GB, que es el peor caso con las 3 sindicaciones.

### P6. Retención de licitaciones (decisión de producto; imprescindible para seguir a 0 €)

**Esfuerzo:** 1 día.

- Con ~3,6 KB por licitación y un ritmo estable estimado de ~2.000–3.500 licitaciones nuevas al día con todas las fuentes, **el canónico llena los 500 MB en ~1,5–3 meses**, aunque P1–P5 estén hechas.
  - Es una estimación: el ritmo de noviembre (~5.000/día) está inflado por el arranque de mes. Se confirma midiendo una semana después de P3–P4.
- **Propuesta de política:** conservar las licitaciones **abiertas**, las **cerradas hace menos de N meses** (por ejemplo 3) y **todas las que estén en favoritos, en "Mis licitaciones" o tengan valoración**. El resto se borra o se mueve a un resumen mínimo.
- Implementación: un job semanal con `delete … where …` en lotes y `VACUUM` después. Hay que respetar las claves foráneas (`tender_events`, `tender_cpvs`, `tender_sources`, `documents`, `favorites`, `offer_*`).

**Hecho cuando:** hay una política aprobada y el tamaño de la base de datos se mantiene estable (±10 %) semana a semana.

### P7. Contratos menores (sindicación 1143)

**Esfuerzo:** 0,5 días.

- Es la sindicación con más volumen.
- Los contratos menores normalmente se publican **ya adjudicados** (art. 63.4 LCSP). Para "encontrar licitaciones a las que presentarse" suelen aportar poco. Hay que confirmarlo con el uso real de Eficen.
- **Opciones:**
  - (a) quitarla;
  - (b) ingerir solo los de CPV relevantes para Eficen;
  - (c) conservarlos pocos días.
- Con (a) o (b) la base de datos crece ~30–40 % menos (estimación).



### P8. Adelgazar el canónico

**Esfuerzo:** 1–2 días. No es urgente.

- **Índice trigram de títulos:** sustituirlo por un diccionario de palabras (vista materializada pequeña, refrescada tras cada ingesta) y hacer `DROP` de `tenders_title_trgm_idx`.
  - Ahorra ~19 % de `tenders` y las búsquedas bajan de ~1,5 s a <70 ms (medido en local el 29-oct).
- `source_artifacts`**:** de 40 MB, 31 son índices (dos `unique` sobre textos largos). Con P3 tendrá pocas filas; si no, valorar guardar los checksums como `bytea` (32 B) en vez de texto hexadecimal.
- `documents`**:** 20 MB para ~39k filas. Revisar si duplica la `source_url` que ya está en `tender_sources`.



### P9. Arreglar el modo `--no-storage`

**Esfuerzo:** 2 h.

- **Hoy:** `InMemoryArtifactStore` (`pipeline/ports.py`) genera rutas y checksums que se guardan en `source_artifacts` aunque el fichero no exista. La deduplicación da esas entradas por vistas para siempre.
- **Propuesta:** en ese modo, `storage_path = NULL` o `stored = false`, y que la deduplicación no considere vistas esas entradas.



### P10. GitHub Actions y repositorio

**Esfuerzo:** 1 h, después de P4.

- **Todos los disparos de cron-job.org con** `ref=main`**.** Para ello hay que mergear a `main` lo que hoy corre desde `mis-licitaciones`.
- Cuando P4 deje el consumo en <1.500 min/mes:
  - **pasar el repo a una organización de GitHub de Eficen** (Free; la empresa pasa a ser la dueña);
  - **hacerlo privado**;
  - fijar el **presupuesto de Actions a 0 $**, para que bloquee en vez de cobrar, y revisar el consumo semanalmente.
- **Si P4 no basta:** un **runner propio en un PC de la oficina** siempre encendido.
  - Es gratis, sin límite de minutos, y está más cerca de Irlanda.
  - Solo debe usarse con el repo privado.
  - Riesgo: GitHub tiene aplazado, sin fecha, un cargo de 0,002 $/min para runners propios.
- **Última opción gratuita:** una VM de Oracle Always Free (2 OCPU / 12 GB). Pide tarjeta, Oracle puede recuperar las VM ociosas y a veces no hay capacidad.
- **Descartadas para este volumen:** GitLab (400 min y 3 h por job), Bitbucket, Codeberg, Render, Railway, Fly.io, Cloudflare Workers y Supabase Edge Functions (150 s).



### P11. Alternativa de pago, como referencia

- Proyecto en la organización PRO: **~10 $/mes**. Da 8 GB de base de datos propios y comparte 100 GB de Storage con el otro proyecto.
- Exceso de Actions sin optimizar: **~36–54 $/mes**.
- Solo si P1–P7 no bastan o si se quiere todo el histórico sin retención.

---



## 3. Decisiones pendientes

1. ¿Se pausan menores y agregadas hasta tener P2–P4? (P0)
2. ¿Se aprueba borrar los 97.356 huérfanos, después de revisar el CSV de la simulación? (P1)
3. ¿Cuántos meses de RAW se conservan en Supabase? Propuesta: 2. (P5)
4. Política de retención de licitaciones: ¿cuántos meses de cerradas? Propuesta: 3, salvo favoritos y "Mis licitaciones". (P6)
5. ¿Contratos menores: fuera, filtrados por CPV o unos días? (P7)
6. ¿Repo a una organización de Eficen y en privado? ¿Hay un PC de oficina que pueda hacer de runner si hiciera falta? (P10)



## 4. Orden propuesto y criterios de éxito


| Orden | Bloque                                                   | Cuándo                            | Indicador de éxito                                                                           |
| ----- | -------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| 1     | P0                                                       | Hoy                               | Cron reducido; pendientes de seguridad revisados                                            |
| 2     | P1                                                       | Esta semana, con ingestas paradas | Huérfanos ≈ 0; Storage < 0,5 GB; base de datos ≈ 235 MB                                      |
| 3     | P2 + P3 + P4 + P9 (una PR, con ADR que sustituye al 022) | Siguiente sprint (3–4 días)       | <10 min por sindicación; <1 MB/día de RAW en base de datos; 0 huérfanos tras cancelar a mano |
| 4     | Reactivar menores/agregadas según P7 y medir 7 días      | Tras la PR                        | Crecimiento real de la base de datos en MB/día                                               |
| 5     | P5 + P6                                                  | Con las cifras del paso 4         | Base de datos y Storage estables semana a semana                                             |
| 6     | P10                                                      | Cuando Actions < 1.500 min/mes    | Repo privado en una organización de Eficen, sin bloqueos                                     |
| 7     | P8                                                       | Cuando haya hueco                 | Búsqueda <70 ms; −15–20 % de tamaño de `tenders`                                             |


**¿Se puede todo a 0 €?** Sí, con dos condiciones:

- el arreglo de código (P2–P4, unos 3–4 días);
- **una política de retención de licitaciones (P6) o quitar los contratos menores (P7).**

Sin el arreglo no es posible: habría que pagar Actions (~36–54 $/mes) y Supabase. Sin retención, el plan Free se llena otra vez en 1,5–3 meses.

---



## Anexo A. Consultas de verificación (solo lectura; ejecutar de una en una en el SQL Editor)

```sql
-- Tamaño total de la base de datos
select pg_size_pretty(pg_database_size(current_database()));

-- Tablas más grandes
select n.nspname || '.' || c.relname as tabla,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total,
       pg_size_pretty(pg_indexes_size(c.oid)) as indices,
       c.reltuples::bigint as filas_aprox
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname not in ('pg_catalog', 'information_schema')
order by pg_total_relation_size(c.oid) desc limit 15;

-- Storage por fuente
select split_part(name, '/', 1) as fuente, count(*) as ficheros,
       pg_size_pretty(sum((metadata->>'size')::bigint)) as bytes
from storage.objects where bucket_id = 'raw' group by 1 order by 2 desc;

-- Huérfanos (left join: source_artifacts.storage_path no tiene índice)
select count(*) as huerfanos,
       pg_size_pretty(sum((o.metadata->>'size')::bigint)) as bytes
from storage.objects o
left join public.source_artifacts a on a.storage_path = 'raw/' || o.name
where o.bucket_id = 'raw' and a.id is null;
```



## Anexo B. Fuentes

- Supabase, tamaño de base de datos y modo solo lectura: [https://supabase.com/docs/guides/platform/database-size](https://supabase.com/docs/guides/platform/database-size)
- Supabase, facturación y restricciones: [https://supabase.com/docs/guides/platform/billing-faq](https://supabase.com/docs/guides/platform/billing-faq)
- Supabase, Storage: [https://supabase.com/docs/guides/platform/manage-your-usage/storage-size](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size)
- GitHub Actions, facturación 2026: [https://docs.github.com/en/billing/concepts/product-billing/github-actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- GitHub Actions, precios por runner: [https://docs.github.com/en/billing/reference/actions-runner-pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)
- GitHub Actions, presupuestos y bloqueo: [https://docs.github.com/en/billing/how-tos/set-up-budgets](https://docs.github.com/en/billing/how-tos/set-up-budgets)
- GitHub, cargo aplazado de runners propios: [https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/)
- Cloudflare R2: [https://developers.cloudflare.com/r2/pricing/](https://developers.cloudflare.com/r2/pricing/)
- Oracle Always Free: [https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- Mediciones en local del 29-oct (carga real de julio de PLACSP): tamaños por entrada y por página, coste por fila en la base de datos y tiempos de búsqueda. Disponibles si hacen falta.

