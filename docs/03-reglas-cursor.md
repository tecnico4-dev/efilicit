# 03 — Reglas de Cursor (cómo se gobierna el asistente)

> **Estado del documento:** FIJO en la existencia y contenido nuclear de las reglas; LIBRE en afinarlas con el tiempo vía ADR.  
> **Propósito:** Explicar qué son las `.cursor/rules`, por qué existen y definir el contenido base de cada archivo de reglas para que Cursor trabaje dentro de los carriles del proyecto.
>
> **Importante:** las reglas de Cursor deben reforzar la arquitectura y los estándares del proyecto, no sustituir la documentación arquitectónica ni convertir cada decisión de implementación en una regla rígida.

---

## 1. La idea central

Hay dos niveles de documentación en este repo, y cumplen funciones distintas:

- **`docs/*.md`** → **referencia**. Es el conocimiento del proyecto: arquitectura, fuentes, roadmap, runbooks, ADRs, etc.
- **`.cursor/rules/*.mdc`** → **reglas duras y operativas**. Son las restricciones que Cursor debe respetar al trabajar sobre el código al que aplica cada regla.

Esta distinción hace realidad el principio de "lo fijo es fijo y lo demás es libre":

> Las reglas de `.cursor/rules/` codifican **lo no negociable para el desarrollo asistido** (stack, seguridad, migraciones, contratos, testing). La arquitectura completa y sus justificaciones viven en `docs/`.

Cursor es el **asistente** del repositorio, no la autoridad de arquitectura. Las reglas existen para que no reinvente decisiones ya tomadas ni introduzca cambios que rompan el diseño.

### Jerarquía de autoridad

Cuando existan instrucciones contradictorias, aplicar este orden:

1. **Seguridad y políticas de plataforma.**
2. **ADRs aprobados y arquitectura fija (`01-arquitectura-fija.md`).**
3. **Reglas aplicables de `.cursor/rules/`.**
4. **Documentación general de `docs/`.**
5. **Preferencias de implementación del desarrollador.**

Si una tarea entra en conflicto con una decisión arquitectónica, Cursor **no debe improvisar una solución alternativa**: debe señalar el conflicto y proponer un ADR cuando corresponda.

---

## 2. Estructura de `.cursor/rules/` 🔒 FIJO

```text
.cursor/
└── rules/
    ├── 00-project-overview.mdc
    ├── 01-architecture.mdc
    ├── 02-python-standards.mdc
    ├── 03-typescript-next.mdc
    ├── 04-supabase-migrations.mdc
    ├── 05-security.mdc
    ├── 06-testing.mdc
    ├── 07-etl-connectors.mdc
    └── 08-adr-changelog.mdc
```

Cada archivo cubre un área. La separación permite que Cursor reciba el contexto adecuado y reduce el riesgo de reglas contradictorias.

> **Nota sobre `.mdc`:** la sintaxis y la cabecera de metadatos de las reglas pueden evolucionar según la versión de Cursor. Antes de crearlas o modificarlas, comprobar la sintaxis soportada por la versión actual de Cursor. El contenido de las reglas y su ámbito de aplicación es lo que debe mantenerse estable.

---

## 3. Contenido base de cada regla

Lo que sigue es el contenido nuclear que debe llevar cada archivo. Es 🔒 **FIJO en su sustancia**; puede reformularse o ampliarse, pero no contradecir la arquitectura.

### `00-project-overview.mdc`

```text
EfiLicit es una plataforma de vigilancia de contratación pública.
Ingiere licitaciones de fuentes oficiales (PLACSP, TED, CCAA y otras),
las unifica en un modelo canónico en PostgreSQL, permite buscarlas
y genera alertas para usuarios.

Modelo mental:
- GitHub contiene código, configuración y documentación.
- GitHub Actions ejecuta trabajo batch.
- Python descarga, valida, parsea y transforma.
- Supabase Storage conserva el RAW original.
- PostgreSQL es la fuente de verdad operativa.
- El frontend (Next.js) consume la capa de datos/API.
- La aplicación NO conoce parsers ni formatos de fuentes.
- El móvil es un cliente posterior.

Antes de escribir código:
1. Inspecciona la estructura existente del repo.
2. Revisa la documentación relevante en docs/.
3. Revisa los ADR aplicables en docs/adr/.
4. Comprueba la fase del roadmap en la que se encuentra la tarea.
5. Respeta las reglas de .cursor/rules/ aplicables al archivo.
```

---

### `01-architecture.mdc`

```text
Decisiones de arquitectura FIJAS:
- Monorepo único.
- GitHub Actions como orquestador de ETL batch inicial.
- Supabase PostgreSQL como source of truth.
- Supabase Storage para RAW inmutable.
- Modelo canónico común a todas las fuentes.
- Búsqueda fase 1 con PostgreSQL FTS + GIN + pg_trgm.
- GIST sólo cuando exista una necesidad concreta y justificada.
- Alertas batch-first.
- Webhooks sólo para side-effects e integraciones secundarias.
- No introducir infraestructura adicional sin necesidad medible y ADR.

No introducir sin ADR:
- Redis.
- Elasticsearch/OpenSearch.
- colas externas.
- backend HTTP permanente como arquitectura principal de ingesta.
- proxies de pago.
- otro framework de frontend.
- otro proveedor de email.

Si una tarea parece requerir una de estas piezas:
1. explica por qué la arquitectura actual no es suficiente;
2. mide o documenta la limitación;
3. propone un ADR;
4. no incorpores el componente directamente.
```

---

### `02-python-standards.mdc`

```text
Ingesta en Python 3.12.x.

Dependencias:
- utilizar uv como gestor del proyecto;
- no instalar dependencias del proyecto con pip a mano;
- respetar pyproject.toml y lockfile.

Librerías principales aprobadas:
- httpx: HTTP;
- lxml: XML;
- pydantic: validación/modelos;
- pandas: sólo cuando simplifique una transformación tabular;
- tenacity: retries;
- scrapy: último recurso cuando no exista acceso oficial mejor.

Estándares:
- tipado con type hints;
- funciones pequeñas y testeables;
- Pydantic en límites de entrada/salida;
- errores explícitos y clasificables;
- timeouts y retries configurados;
- código idempotente;
- soporte para checkpoints cuando la fuente lo permita;
- no loguear secretos.

No añadir una dependencia nueva sólo por comodidad.
Si una dependencia aporta un beneficio significativo, justificarla en el PR
y crear ADR si cambia la arquitectura o introduce un proveedor/componente nuevo.
```

---

### `03-typescript-next.mdc`

```text
Frontend:
- Next.js;
- React;
- TypeScript;
- Tailwind CSS.

Reglas:
- no meter lógica de negocio compleja en componentes React;
- centralizar el acceso a datos en lib/queries o una capa equivalente;
- reutilizar tipos generados desde el esquema Supabase cuando estén disponibles;
- validar entradas;
- separar datos públicos de datos privados;
- todo acceso privado debe estar protegido por RLS;
- nunca usar service_role key en frontend;
- no acceder directamente a RAW Storage desde la UI como mecanismo de negocio.

LIBRE:
- diseño visual;
- naming de componentes;
- organización interna de UI;
- patrones internos de composición, si respetan las APIs y contratos del proyecto.
```

---

### `04-supabase-migrations.mdc`

```text
Toda modificación de esquema PostgreSQL pasa por una migración versionada.

Flujo:
1. supabase migration new <nombre>
2. editar SQL
3. supabase db reset
4. ejecutar tests
5. revisar impacto
6. CI
7. desplegar de forma controlada

PROHIBIDO:
- cambiar el esquema de producción manualmente desde SQL Editor/Table Editor;
- crear tablas/índices/funciones permanentes fuera de migraciones;
- modificar el esquema remoto y después intentar "ponerse al día".

Las migraciones son la fuente versionada del esquema.

Toda modificación de:
- tablas;
- índices;
- funciones;
- triggers;
- políticas RLS;
- buckets/policies de Storage cuando se gestionen como parte del esquema del proyecto;
debe quedar reproducible y revisable.
```

---

### `05-security.mdc`

```text
Seguridad por defecto:
- RLS habilitado en TODAS las tablas expuestas;
- políticas diseñadas por usuario/rol;
- anon/publishable para frontend cuando corresponda;
- authenticated para usuarios autenticados;
- service_role exclusivamente en procesos confiables;
- service_role NUNCA en navegador;
- secretos en GitHub/Supabase/Vercel secrets;
- nunca secretos en código ni .env versionado;
- logs sin PII innecesaria;
- nunca loguear tokens, claves o credenciales.

Reglas de datos de usuario:
- un usuario nunca puede leer/modificar alertas o favoritos de otro usuario;
- las operaciones administrativas deben quedar separadas de la experiencia normal de usuario;
- no ampliar permisos "para que funcione" sin entender la política RLS.

Ante cualquier duda de seguridad:
- parar;
- no desactivar RLS como solución temporal;
- documentar el caso;
- pedir revisión/crear ADR si afecta arquitectura.
```

---

### `06-testing.mdc`

```text
Todo parser nuevo:
- fixture de fuente;
- tests de parseo;
- tests de normalización;
- tests de casos límite.

Todo bug reproducible:
- crear o ampliar un test de regresión antes o junto con el fix.

Niveles:
- unit;
- parser;
- contract;
- integration;
- dedup/entity resolution;
- e2e;
- workflow;
- smoke.

Requisitos:
- no aceptar un parser porque "funciona con un fichero";
- probar al menos un caso válido, un caso incompleto y un caso inesperado;
- para cambios sensibles, ejecutar regresión de la parte afectada;
- los tests deben ser reproducibles y no depender de servicios externos en los tests unitarios.

Cuando un test requiera datos reales, utilizar fixtures controlados/anonimizados y nunca secretos.
```

---

### `07-etl-connectors.mdc`

```text
Los conectores son responsables de conocer una fuente concreta.
El pipeline común es responsable del procesamiento canónico.

Contrato mínimo del conector:

discover()
fetch()
parse()

Pipeline común:

discover
→ fetch
→ validate_artifact
→ store_raw
→ parse
→ normalize
→ enrich
→ resolve_identity
→ deduplicate
→ quality_checks
→ upsert
→ emit_events
→ checkpoint

Requisitos FIJOS de cada conector:
- idempotente: repetir no duplica ni corrompe;
- incremental: procesa sólo lo nuevo/modificado cuando la fuente lo permita;
- trazable:
  source → artifact → parser → canonical record;
- registra estado en source_sync;
- registra el artefacto en source_artifacts;
- utiliza fuente oficial primero;
- scraping sólo como último recurso;
- respeta timeouts, rate limits y condiciones de acceso;
- no contamina el modelo canónico con campos específicos de la fuente;
- no pone lógica de negocio exclusiva del producto dentro del parser.

Identidad:
- utilizar NIF/CIF u otro identificador oficial como señal primaria cuando exista;
- nunca utilizar el nombre como identificador único;
- si faltan identificadores fiables, usar múltiples señales y registrar confidence.

LIBRE:
- implementación interna;
- clases auxiliares;
- estrategia de paginación;
- parser concreto;
- cachés;
- organización interna del conector.

Si dos fuentes comparten formato pero no semántica, no forzar una abstracción común.
```

---

### `08-adr-changelog.mdc`

```text
Todo cambio de arquitectura requiere un ADR en docs/adr/.

Plantilla mínima:
- Estado
- Contexto
- Decisión
- Alternativas
- Consecuencias
- Riesgos
- Fecha
- Referencias

Si una decisión contradice un ADR existente:
- NO sobrescribir silenciosamente el ADR;
- proponer un nuevo ADR que explique el cambio.

Todo cambio funcional importante actualiza CHANGELOG.md en el mismo PR.

Convención de commits:
- feat
- fix
- refactor
- test
- docs
- chore
- ci
- perf
- security

Formato de changelog:
Keep a Changelog.

No crear un ADR para decisiones puramente internas que no afectan arquitectura,
seguridad, contratos o dependencias estructurales.
```

---

## 4. El prompt maestro 🔒 FIJO

El prompt maestro resume el rol de Cursor y debe mantenerse alineado con los archivos `.cursor/rules/`.

### Reglas maestras

1. Antes de crear código, inspecciona la estructura existente.
2. Determina la fase del roadmap antes de ampliar el alcance.
3. Respeta `01-arquitectura-fija.md`, ADRs y CHANGELOG.
4. No cambies producción directamente.
5. Los cambios de DB deben ser migraciones.
6. Todo conector debe ser idempotente e incremental cuando sea posible.
7. Conserva trazabilidad `source → artifact → parser → canonical record`.
8. No uses scraping si existe una API/Open Data/feed oficial adecuado.
9. No introduzcas dependencias o proveedores nuevos sin justificarlo.
10. Todo parser nuevo necesita fixtures y tests.
11. Todo cambio sensible necesita test de regresión.
12. No pongas secretos en código.
13. No uses service-role key en frontend.
14. Prioriza simplicidad, calidad de datos y coste controlado.
15. Si una decisión contradice un ADR o la arquitectura fija, propón un nuevo ADR.
16. No amplíes una tarea más allá de la fase actual sin explicarlo.
17. Si falta información para implementar una decisión arquitectónica, no la inventes: señala el hueco y pide/propone documentación.

---

## 5. Cómo usar las reglas en el día a día

- **No hace falta recordárselas a Cursor en cada mensaje.** Las reglas se cargan según su ámbito de aplicación.
- Antes de una tarea relevante, indica el contexto:
  - fase del roadmap;
  - módulo;
  - objetivo;
  - restricciones.
- Si Cursor propone algo que contradice una regla, **no aceptar el cambio sin entender por qué**.
- Si la propuesta afecta a arquitectura, dependencia, seguridad, modelo de datos o ejecución, debe evaluarse como posible ADR.
- Para tareas pequeñas, pedir cambios pequeños y verificables.
- Revisar siempre el diff generado.
- Ejecutar los tests correspondientes antes de dar por finalizada una tarea.
- Actualizar documentación cuando una implementación cambie un contrato.

### Ejemplo de petición buena

```text
Estamos en la Fase 3: vertical slice de PLACSP.

Objetivo:
implementar el parser de artefactos Atom/CODICE para el fixture X.

Restricciones:
- respetar el SourceConnector;
- guardar trazabilidad;
- no tocar el modelo canónico todavía salvo que el contrato ya lo contemple;
- añadir fixtures y tests;
- no introducir dependencias nuevas.

Primero inspecciona las reglas y la estructura existente.
Después propón los archivos que modificarías.
```

### Ejemplo de petición mala

```text
Constrúyeme todo el scraper de España y decide tú cómo guardar los datos.
```

La segunda petición entrega a Cursor decisiones que la arquitectura ya ha cerrado.

---

## 6. Filosofía: reglas como carriles, no como jaula

Las reglas no están para limitar la creatividad, sino para **liberarla donde importa**.

Al fijar lo estructural:

- seguridad;
- migraciones;
- contratos;
- trazabilidad;
- testing;
- stack;

se evita gastar energía re-decidiendo lo ya decidido.

Y queda libertad para:

- UX;
- algoritmos internos;
- diseño de parsers;
- queries;
- componentes;
- mejoras de rendimiento;
- experimentos controlados.

> **Carriles en la carretera, no vías de tren:** marcan por dónde no salirse, pero dentro hay mucho espacio para conducir.

---

## 7. Qué NO debe hacer Cursor automáticamente

Cursor no debe:

- crear un segundo proyecto Supabase;
- modificar producción manualmente;
- saltarse una migración;
- introducir una base de datos alternativa;
- introducir Redis/OpenSearch "por si acaso";
- poner service-role keys en frontend;
- desactivar RLS para solucionar un problema;
- crear un conector que devuelva un modelo distinto al canónico;
- usar nombre como identidad única de entidades;
- duplicar lógica de negocio dentro de cada parser;
- enviar un email directamente por cada `INSERT` de una carga masiva;
- convertir un webhook en el motor principal de alertas;
- borrar tests para conseguir que CI pase;
- sobrescribir un ADR existente para ocultar una decisión que cambió.

---

## 8. Qué leer antes de ejecutar tareas complejas

Antes de una tarea relevante, Cursor/developer debe revisar:

1. `00-onboarding.md`
2. `01-arquitectura-fija.md`
3. el ADR más cercano al área de trabajo
4. `04-roadmap-mvp.md`
5. la documentación de la fuente si se trata de ingesta (`docs/sources/`)
6. las reglas `.cursor/rules/` aplicables

No es necesario cargar toda la documentación para una tarea trivial, pero sí la que define el contrato que se está tocando.

---

## Qué leer después

- `04-roadmap-mvp.md` — el plan de desarrollo fase a fase hasta el MVP.
- `docs/adr/` — decisiones arquitectónicas existentes.
- `docs/sources/` — documentación de cada fuente de datos.
- `CONTRIBUTING.md` — flujo de trabajo del repositorio.
