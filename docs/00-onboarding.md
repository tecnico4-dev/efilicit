# 00 — Onboarding a EfiLicit

> **Estado del documento:** GUÍA (orientativo)  
> **Propósito:** Dar la visión completa de EfiLicit antes de tocar una sola línea de código. Si es el primer día en el proyecto, este es el primer documento que hay que leer, de principio a fin, sin saltarse nada.  
> **Tiempo de lectura:** ~30 minutos.

---

## 1. Qué es EfiLicit en una frase

EfiLicit es una **plataforma de vigilancia de contratación pública**: ingiere licitaciones de fuentes oficiales (PLACSP, TED, portales autonómicos…), las unifica en un único modelo de datos, permite buscarlas y avisa a cada usuario cuando aparece una oportunidad que encaja con sus criterios.

Dicho de forma todavía más simple: **una empresa quiere enterarse de los concursos públicos que le interesan sin tener que mirar 20 webs distintas cada mañana. EfiLicit lo hace por ella.**

---

## 2. El problema real que resuelve

En España (y Europa) las oportunidades de contratación pública están **dispersas y en formatos incompatibles**:

- El Estado publica en PLACSP (XML/ATOM, formato CODICE).
- La Unión Europea publica en TED (su propia API y XML).
- Cada comunidad autónoma tiene su propio portal, con su propio formato. Algunas ofrecen API/Open Data; otras XML/JSON/CSV, feeds o descargas; algunas pueden requerir scraping como último recurso.
- Además hay boletines oficiales (BOE, BOP, DOGC…).

La **misma licitación** puede aparecer en varios sitios a la vez, escrita de forma distinta en cada uno. Una empresa que quiera vigilar todo esto a mano necesita un equipo dedicado. EfiLicit automatiza esa vigilancia.

---

## 3. El modelo mental (la imagen que hay que tener en la cabeza)

Este es el resumen que explica todo el sistema. Merece la pena memorizarlo porque cada decisión técnica se entiende a partir de aquí:

> **GitHub** guarda el código, la configuración, los workflows y la documentación.
>
> **GitHub Actions** ejecuta el trabajo batch (por lotes) sobre runners temporales.
>
> **Python** descarga, valida, parsea, transforma y carga los datos.
>
> **Supabase Storage** conserva el material original sin tocar (el "RAW").
>
> **PostgreSQL** conserva el modelo canónico: la única versión de la verdad operativa.
>
> **Los índices de PostgreSQL** aceleran las búsquedas.
>
> **El motor de alertas** decide qué notificar a cada usuario.
>
> **Resend** entrega los emails.
>
> **Next.js / Vercel** es la interfaz web.
>
> **La app móvil** es otro cliente, para una fase muy posterior.

### Qué NO es cada cosa

- **GitHub no es la base de datos de EfiLicit.** No se guardan allí las licitaciones.
- **Los archivos `.yml/.yaml` no contienen los datos.** Son instrucciones declarativas para que GitHub Actions sepa cuándo y cómo ejecutar código.
- **GitHub Actions no es el almacenamiento permanente.** El runner que ejecuta un job es temporal.
- **Supabase Storage no es la base de datos relacional.** Guarda archivos/objetos RAW.
- **PostgreSQL no debe almacenar como sustituto del RAW los ficheros originales completos**, salvo casos concretos que estén justificados.

Si en cualquier momento hay dudas sobre "¿dónde debería vivir esta lógica?", volver a este apartado. Casi siempre responde la pregunta.

---

## 4. Recorrido por el stack (siguiendo el diagrama `EfiLicitStack2.png`)

El diagrama del proyecto está dividido en 11 bloques numerados, más una columna de "Flujo general" a la derecha. Vamos a recorrerlo en el mismo orden en que fluyen los datos, porque así se entiende el sistema como una tubería: **entra material bruto por arriba y sale una alerta útil por abajo.**

### Bloque 1 — Fuentes de datos (externas)

De dónde sale la materia prima. Cuatro grandes grupos:

- **Administración del Estado → PLACSP.** Datos abiertos en XML/ATOM, con modificaciones diarias e histórico anual. Es la primera fuente que se implementa.
- **Unión Europea → TED** (Tenders Electronic Daily). Tiene API de búsqueda y paquetes XML diarios.
- **Comunidades autónomas y entidades locales.** Aquí está el caos: cada una puede tener su propio mecanismo. Algunas ofrecen API/Open Data, otras XML/JSON/CSV o descargas, y algunas pueden requerir scraping como último recurso.
- **Otras fuentes oficiales.** Boletines (BOE/BOP/DOG/DOU), datos.gob.es y otros datasets o perfiles oficiales cuando aporten cobertura adicional.

### Regla de acceso a fuentes (por orden de preferencia)

1. API oficial.
2. Open Data oficial.
3. Feeds/XML/JSON/CSV oficiales.
4. Descarga directa de fichero oficial.
5. Scraping controlado como último recurso.

El scraping es siempre el último recurso, nunca la primera opción.

> **Recurso clave — catálogo de fuentes.** [contratacionabierta.com](https://contratacionabierta.com/) es un catálogo de referencia muy útil para descubrir fuentes oficiales de contratación pública española, sus URLs, formatos y mecanismos de acceso. **No debe considerarse una garantía de cobertura exhaustiva.**
>
> El proyecto open source `dcarrero/contratacion-publica-abierta` puede utilizarse como **referencia de diseño** para estudiar normalización y modelos de datos. No se copia código sin una decisión y revisión explícitas.

### Regla importante sobre las fuentes

No debemos asumir que una comunidad autónoma tiene API, Open Data o un formato concreto hasta comprobarlo. Cada fuente debe documentarse individualmente en `docs/sources/` indicando:

- organismo/fuente;
- URL oficial;
- mecanismo de acceso;
- formato;
- frecuencia de actualización conocida;
- identificadores disponibles;
- límites/rate limits;
- método incremental;
- necesidad o no de scraping;
- observaciones de cobertura;
- fuente alternativa o de respaldo si existe.

---

### Bloque 2 — Ingesta y orquestación (el motor ETL)

Aquí es donde el sistema "trabaja". El orquestador inicial es **GitHub Actions**, dentro de una estrategia **serverless-first**: no mantenemos un servidor propio para el procesamiento batch mientras el volumen no lo justifique.

Cada fuente tiene su propio workflow independiente (`placsp.yml`, `ted.yml`, `ccaa.yml`…), programado con cron a distintas horas del día o lanzado manualmente cuando sea necesario.

Un archivo `.yml/.yaml` de GitHub Actions **no hace por sí mismo la extracción**. Define el workflow: cuándo se ejecuta, qué runner utilizar, qué secretos necesita y qué comandos debe lanzar. El trabajo real lo realizan los scripts del proyecto.

Ejemplo conceptual:

```text
placsp.yml
    ↓
GitHub Actions
    ↓
runner temporal
    ↓
Python
    ↓
conector PLACSP
    ↓
descarga → validación → RAW → parseo → normalización → DB
```

El lenguaje del motor es **Python 3.12+**, con librerías clave:

- `httpx` para peticiones HTTP;
- `lxml` para parseo XML;
- `pydantic` para validación de estructuras;
- `pandas` para transformaciones donde aporte valor;
- `tenacity` para reintentos;
- `scrapy` sólo cuando no exista una alternativa mejor.

Características transversales del motor:

- reintentos automáticos;
- timeouts;
- rate limits y respeto de las condiciones de la fuente;
- control de checksums;
- procesamiento incremental;
- idempotencia;
- logs;
- métricas de cada ejecución;
- captura y clasificación de errores;
- checkpoints/cursors cuando la fuente los permita;
- healthchecks;
- capacidad de reprocesar un artefacto histórico.

### ¿Dónde guarda el motor su estado?

No en GitHub Actions. El runner es temporal.

La ejecución deja el estado persistente en Supabase, principalmente mediante:

- `source_sync` para el estado de cada sincronización;
- `source_artifacts` para el registro de los ficheros/artefactos descargados;
- Supabase Storage para el RAW;
- PostgreSQL para los datos procesados.

---

### Bloque 3 — Almacenamiento RAW (Data Lake)

Todo lo que se descarga se guarda **tal cual, sin transformar**, en Supabase Storage, organizado por `fuente/año/mes/día/archivo`.

Ejemplo:

```text
raw/
├── placsp/
│   └── 2026/08/13/<artifact>.zip
├── ted/
│   └── 2026/08/13/<artifact>.xml
├── cataluna/
│   └── 2026/08/13/<artifact>.json
└── galicia/
    └── 2026/08/13/<artifact>.csv
```

Esto no es la base de datos: es el **archivo de evidencia** y la materia prima para poder reprocesar si algo sale mal.

Cada artefacto RAW debe estar asociado a metadata suficiente para responder:

- qué fuente era;
- cuándo se descargó;
- de qué URL/proceso salió;
- qué checksum tiene;
- qué ejecución lo descargó;
- qué parser/versionado lo procesó posteriormente.

Se conserva el material original según la política de retención definida para el proyecto.

---

### Bloque 4 — Procesamiento de datos

El procesamiento es **incremental y continuo por fuente/lote**. No se espera a tener "todo España descargado" para empezar.

El orden de referencia es:

```text
1. Descarga
2. Validación del artefacto
3. Guardar RAW
4. Parsear
5. Normalizar
6. Enriquecer
7. Entity Resolution
8. Deduplicar
9. Validar calidad
10. Upsert en PostgreSQL
11. Actualizar/mantener índices
12. Generar eventos
13. Evaluar alertas por lotes
```

#### 1. Normalización

Llevar todo a un esquema común:

- fechas;
- importes;
- moneda;
- CPV;
- geografía;
- NUTS;
- tipos de contrato;
- estados;
- procedimientos;
- organismos;
- identificadores.

#### 2. Enriquecimiento

Añadir información derivada o normalizada:

- clasificación CPV;
- diccionarios;
- geografía/NUTS;
- normalización de nombres;
- relaciones con entidades maestras.

La **geocodificación no es un requisito inicial del MVP**. Sólo se incorpora si una funcionalidad posterior la necesita.

#### 3. Entity Resolution

Identificar que distintas representaciones corresponden a la misma **entidad canónica**, por ejemplo:

- una misma licitación;
- un mismo organismo;
- una misma empresa.

La deduplicación de licitaciones es un caso concreto de Entity Resolution.

#### 4. Deduplicación de licitaciones

La misma licitación puede aparecer en PLACSP, TED y una plataforma autonómica. El sistema debe intentar unificarla bajo un `canonical_tender_id`, conservando todas las referencias de origen.

#### 5. Histórico y eventos

Los cambios relevantes de una licitación se registran como eventos:

- publicada;
- modificada;
- plazo cambiado;
- adjudicada;
- desierta;
- cancelada;
- formalizada;
- etc.

Esto permite construir una línea temporal y detectar cambios relevantes.

#### 6. Validación y calidad

Se aplican reglas de calidad y métricas para detectar:

- importes inválidos;
- fechas imposibles;
- identificadores ausentes;
- formatos inesperados;
- duplicidades;
- caídas silenciosas de una fuente.

---

### Bloque 5 — Base de datos principal (Supabase PostgreSQL)

La **fuente de verdad operativa** del sistema. Aquí vive el modelo canónico de EfiLicit.

Tablas clave:

- `tenders` — licitaciones canónicas;
- `tender_sources` — referencias de la licitación en cada fuente;
- `tender_events` — historial de cambios;
- `contracting_authorities` — organismos;
- `suppliers` — empresas/adjudicatarios;
- `cpv` — catálogo CPV;
- `geography` — geografía/NUTS;
- `documents` — metadata/enlaces de documentos;
- `users` — perfiles de usuario;
- `saved_searches` — búsquedas guardadas;
- `alerts` — reglas de alerta;
- `notification_queue` — cola de notificaciones;
- `source_sync` — estado de sincronización de fuentes;
- `source_artifacts` — registro de artefactos descargados;
- `errors` — errores operativos.

### Migraciones: regla obligatoria

Todo cambio en el esquema PostgreSQL debe hacerse mediante **migraciones versionadas** en `supabase/migrations/`.

No se debe utilizar el cambio manual de tablas en producción como mecanismo habitual de evolución del esquema.

Flujo:

```text
crear migración
    ↓
probar localmente
    ↓
CI
    ↓
preview/staging
    ↓
producción
```

### El motor de búsqueda

La primera fase utiliza PostgreSQL:

- **B-tree** para filtros y rangos exactos;
- **Full Text Search + GIN** para texto;
- **pg_trgm** para similitud/errores tipográficos;
- **GIST** cuando exista un caso de uso que lo justifique;
- ranking por relevancia.

Ejemplo mental:

```text
importe > 100000
→ B-tree

CPV = 72200000
→ B-tree

"software mantenimiento madrid"
→ FTS + GIN

"ayuntaminto"
→ pg_trgm
```

No existe un "motor de búsqueda separado" que haya que reconstruir después de cada carga. PostgreSQL mantiene sus índices a medida que los datos cambian y las consultas utilizan esos índices.

No se introduce Elasticsearch/OpenSearch en la primera fase salvo que las métricas demuestren una necesidad real y exista un ADR que lo justifique.

Supabase aporta además:

- Auth;
- Storage;
- Edge Functions;
- Database Webhooks;
- Data API.

---

### Bloque 6 — API y lógica de negocio

Supabase autogenera una **API REST** a partir del esquema de PostgreSQL.

Para operaciones sencillas y consultas bien acotadas se puede utilizar directamente la Data API.

Para necesidades más complejas:

- **RPC/funciones SQL** para consultas o lógica cercana a los datos;
- **Edge Functions** para lógica ligera que necesite secretos, llamadas a servicios externos o composición de varias operaciones.

La API no se considera "automáticamente segura" por el hecho de existir. Las tablas expuestas deben tener:

- grants correctos;
- RLS;
- políticas por operación/usuario;
- separación entre claves públicas y claves secretas.

**Nunca** se expone una `service_role` key en frontend.

---

### Bloque 7 — Motor de alertas

El flujo es:

```text
Reglas de alerta del usuario
        ↓
Matching
        ↓
Scoring / prioridad
        ↓
Deduplicación
        ↓
notification_queue
```

La primera versión debe priorizar reglas deterministas:

- CPV;
- palabras clave;
- organismo;
- geografía;
- importe;
- tipo de contrato;
- procedimiento;
- ventanas de fechas.

Posteriormente se puede añadir scoring más sofisticado o matching semántico.

### Diseño batch-first

Las alertas se evalúan **por tandas**, no disparando lógica pesada o un email por cada `INSERT`.

Ejemplo:

```text
2.000 nuevas/actualizadas
        ↓
job de alertas
        ↓
matching con las reglas
        ↓
notification_queue
        ↓
email / push / digest
```

La tabla `notification_queue` permite:

- reintentos;
- deduplicación;
- programación;
- auditoría;
- estados `pending`, `processing`, `sent`, `failed`, etc.;
- cambiar el proveedor de email en el futuro.

---

### Bloque 8 — Notificaciones

**Resend** para email transaccional.

Canales previstos:

- email inmediato;
- digest diario;
- digest semanal;
- web push;
- posteriormente push móvil;
- integraciones mediante webhooks técnicos.

### Digest

Un digest es un resumen agrupado.

En lugar de enviar 20 emails por 20 coincidencias:

> **Resumen diario EfiLicit — 20 nuevas oportunidades**

y dentro aparecen todas las coincidencias del día.

La frecuencia de cada alerta debe ser configurable por el usuario.

### Webhooks

Los Webhooks son un mecanismo técnico para avisar a otro sistema de que ha ocurrido un evento.

No son lo mismo que:

- email;
- web push;
- push móvil.

En EfiLicit se utilizan para **integraciones o side-effects ligeros**, no como motor principal de alertas masivas.

---

### Bloque 9 — Frontend web

**Next.js (React + SSR) + Tailwind CSS + Vercel.**

Funcionalidades previstas:

- búsqueda avanzada;
- filtros;
- ficha de licitación;
- historial;
- favoritos;
- seguimiento;
- alertas;
- dashboard;
- documentos;
- perfil/configuración.

La web consume la capa de datos/API; no accede directamente a los ficheros RAW como mecanismo normal de consulta.

---

### Bloque 10 — App móvil (fase posterior)

Kotlin + Jetpack Compose + Supabase Kotlin SDK.

**No se toca hasta que la web y las alertas estén validadas.**

La app no tendrá una base de datos ni un backend paralelos: será otro cliente de EfiLicit sobre la misma plataforma.

---

### Bloque 11 — Operaciones, monitorización y seguridad

Este bloque garantiza que EfiLicit no sólo "funciona", sino que sabemos cuándo deja de funcionar.

Incluye:

- healthchecks;
- logs;
- métricas de jobs;
- backups;
- CI/CD;
- seguridad;
- RLS;
- secretos;
- auditoría;
- control de sincronización por fuente.

### `source_sync`

Una tabla especialmente importante para vigilar fuentes:

```text
source_sync
├── source_code
├── run_id
├── started_at
├── finished_at
├── status
├── cursor
├── last_artifact
├── checksum
├── records_seen
├── records_new
├── records_updated
├── records_failed
└── error_message
```

Ejemplo de lectura:

```text
PLACSP   ✅  4.821 nuevos
TED      ✅    142 nuevos
Galicia  ✅     38 nuevos
Cataluña ❌     error 403
```

Un job puede terminar correctamente y, aun así, haber recibido cero datos cuando debería haber recibido miles. Por eso las métricas de calidad son parte de la salud del sistema.

---

## 5. Los principios clave (la columna derecha del diagrama)

Estos principios son la brújula del proyecto:

1. **Serverless-first** — empezamos sin servidores propios para el procesamiento batch. Si el volumen lo exige, la arquitectura puede incorporar workers dedicados sin rehacerse.
2. **Escalable por diseño** — la arquitectura crece sin reescribir el modelo de datos.
3. **Coste optimizado** — se empieza barato y se escala sólo cuando las métricas justifican el coste.
4. **Alta calidad de datos** — la calidad del dato es el producto.
5. **Trazabilidad completa** — todo registro se puede rastrear hasta su fuente y artefacto de origen.
6. **Fácil de mantener** — simplicidad sobre sofisticación.
7. **Seguridad y privacidad** — RLS y mínimo privilegio desde el día 1.

---

## 6. Cómo trabajar con Cursor en este proyecto

Cursor es el asistente de desarrollo, **no la autoridad de arquitectura.** Esta distinción es importante:

- La arquitectura, el stack y las decisiones estructurales **ya están tomadas** y documentadas. Cursor las respeta, no las reinventa.
- Cursor ayuda a escribir el código dentro de esas reglas: genera parsers, componentes, tests, migraciones… pero siempre dentro de los carriles definidos.

### Reglas prácticas para trabajar con Cursor

- Antes de pedirle que escriba código, asegurarse de que tiene el contexto: los `.md` de `docs/` y las reglas de `.cursor/rules/` deben estar en el repo.
- Si Cursor propone introducir una librería nueva, un proveedor nuevo o cambiar una decisión de arquitectura → **parar**. Eso requiere un ADR, no una decisión sobre la marcha.
- Pedirle cambios pequeños y verificables, no "constrúyeme el proyecto entero". El desarrollo va por fases.
- Todo lo que genere Cursor se revisa. Es un copiloto, no un piloto automático.
- Si una tarea modifica base de datos, crear migración antes de tocar producción.
- Si una tarea añade una nueva fuente, crear el conector + fixture + tests + documentación de la fuente.
- Si un cambio afecta cobertura o calidad de datos, registrar métricas antes y después cuando sea posible.

**El prompt maestro** para Cursor está en el documento técnico y en `.cursor/rules/`. Define el stack aprobado y las reglas duras. Conviene leerlo una vez con calma.

---

## 7. Qué NO hacer

Estas reglas son especialmente importantes para una persona nueva en el proyecto.

### No hacer

- **No** modificar producción directamente como procedimiento habitual.
- **No** crear/modificar tablas sin migración.
- **No** guardar licitaciones o RAW en GitHub.
- **No** guardar secretos en el repositorio.
- **No** procesar el histórico completo cada día si existe un mecanismo incremental.
- **No** crear un nuevo modelo de licitación para una nueva fuente.
- **No** hacer scraping si existe API/Open Data/feed oficial.
- **No** introducir Redis, OpenSearch/Elasticsearch, proxies u otros servicios por adelantado.
- **No** convertir los Webhooks en el motor de alertas masivas.
- **No** enviar un email por cada `INSERT` de una carga masiva.
- **No** cambiar una decisión arquitectónica porque "Cursor lo recomienda".

### Sí hacer

- **Sí** crear conectores independientes.
- **Sí** conservar RAW.
- **Sí** respetar el modelo canónico.
- **Sí** hacer los jobs idempotentes.
- **Sí** registrar `source_sync`.
- **Sí** escribir tests con fixtures reales.
- **Sí** documentar cada fuente.
- **Sí** usar ADR para decisiones nuevas.
- **Sí** actualizar CHANGELOG en cambios relevantes.
- **Sí** priorizar corrección de datos sobre velocidad de implementación.

---

## 8. Glosario rápido

| Término | Significado |
|---|---|
| **Tender** | Una licitación / concurso público. Es la entidad central del sistema. |
| **PLACSP** | Plataforma de Contratación del Sector Público (fuente estatal española). |
| **TED** | Tenders Electronic Daily (fuente de la Unión Europea). |
| **CCAA** | Comunidades Autónomas (fuentes regionales). |
| **CODICE** | Estándar XML español para documentos de contratación pública. |
| **CPV** | Common Procurement Vocabulary: código que clasifica el objeto de un contrato. |
| **NUTS** | Nomenclatura europea de unidades territoriales. |
| **RAW** | Los archivos originales sin transformar, guardados como evidencia. |
| **Canonical model** | El modelo de datos unificado: todas las fuentes acaban aquí. |
| **Entity Resolution** | Proceso de identificar que distintas representaciones corresponden a la misma entidad canónica. |
| **Idempotencia** | Ejecutar un proceso dos veces produce el mismo resultado lógico, sin duplicar datos. |
| **ETL** | Extract, Transform, Load: el flujo de extraer → transformar → cargar. |
| **RLS** | Row Level Security: seguridad a nivel de fila en PostgreSQL. |
| **ADR** | Architecture Decision Record: documento que registra una decisión de arquitectura. |
| **FTS** | Full Text Search: búsqueda lingüística en PostgreSQL. |
| **Upsert** | Insertar si no existe, actualizar si existe. |
| **Vertical slice** | Implementar una funcionalidad completa de punta a punta. |
| **Source connector** | Código específico de una fuente que descubre, descarga y parsea sus datos. |
| **Artifact** | Fichero o recurso descargado de una fuente externa. |
| **Checkpoint / cursor** | Estado que permite continuar una sincronización sin rehacer trabajo. |
| **Digest** | Resumen agrupado de varias notificaciones. |
| **Webhook** | Aviso técnico de que ha ocurrido un evento para integraciones o side-effects; no es sinónimo de email o push. |
| **Serverless-first** | Estrategia de inicio sin servidores propios, con capacidad de incorporar workers dedicados cuando sea necesario. |

---

## 9. Qué leer después de esto

1. `01-arquitectura-fija.md` — las decisiones que **no se deben cambiar sin ADR**.
2. `02-setup-entorno.md` — montar el entorno de trabajo de cero.
3. `03-git-github-cursor.md` — flujo de ramas, PR, commits, ADRs, changelog y uso de Cursor.
4. `04-roadmap-mvp.md` — el plan fase a fase hasta el MVP.

---

## 10. Recomendaciones antes de empezar

- **No intentar entenderlo todo el primer día.** Este documento da el mapa; el terreno se aprende construyendo.
- **Empezar siempre por una fuente completa (PLACSP), de punta a punta**, antes de tocar ninguna otra. Es la decisión de diseño más importante del arranque: valida toda la tubería con un caso real antes de multiplicar.
- **La calidad de los datos es el producto.** El código puede ser perfecto, pero si dos licitaciones iguales aparecen duplicadas o un importe se parsea mal, el usuario pierde confianza.
- **Ante la duda sobre dónde vive una lógica**, volver al modelo mental del punto 3.
- **Cualquier decisión de arquitectura nueva → ADR.** No se cambia el rumbo del proyecto en un commit suelto.
- **Cuando una fuente falle, no arreglar el dato manualmente en producción.** Investigar el conector, corregirlo, probarlo y reprocesar el RAW.

---

## 11. Resumen en una sola vista

```text
FUENTES OFICIALES
    ↓
CONECTORES
    ↓
GITHUB ACTIONS
    ↓
PYTHON
    ↓
VALIDAR
    ↓
RAW → SUPABASE STORAGE
    ↓
PARSEAR
    ↓
NORMALIZAR
    ↓
ENRIQUECER
    ↓
ENTITY RESOLUTION
    ↓
DEDUPLICAR
    ↓
VALIDAR CALIDAD
    ↓
POSTGRESQL
    ├── búsqueda
    ├── histórico
    ├── eventos
    └── usuarios/alertas
            ↓
      ALERT ENGINE
            ↓
   notification_queue
       ├── Resend
       ├── Web Push
       ├── Digest
       └── App (futuro)
            ↓
     NEXT.JS / VERCEL
            ↓
          USUARIO
```

> **Objetivo del onboarding:** al terminar este documento, la persona debe poder explicar qué hace cada bloque, dónde vive cada tipo de información y dónde NO debe colocarla. El siguiente paso ya no es inventar arquitectura: es ejecutar el plan documentado.
