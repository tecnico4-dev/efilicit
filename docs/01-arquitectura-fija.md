# 01 — Arquitectura fija (lo que no se toca)

> **Estado del documento:** FIJO (no negociable)  
> **Propósito:** Definir con precisión qué decisiones son inamovibles y cuáles quedan abiertas a criterio propio. Este documento es el contrato: separa lo sagrado del lienzo en blanco.  
> **Para Cursor:** Todo lo marcado como FIJO en este documento tiene prioridad sobre cualquier sugerencia. Si una tarea contradice algo de aquí, no se implementa: se propone un ADR.

---

## Cómo leer este documento

Cada sección lleva una etiqueta:

- 🔒 **FIJO** — Decisión cerrada. No se cambia sin un ADR aprobado. Cursor y el desarrollo la respetan siempre.
- 🎨 **LIBRE** — Zona de decisión propia. Aquí hay rienda suelta a la creatividad: se elige, se experimenta, se itera.
- ⚠️ **FIJO EN EL QUÉ, LIBRE EN EL CÓMO** — El objetivo o contrato es obligatorio, pero la forma de conseguirlo es abierta.

La filosofía es simple: **lo que sostiene el sistema es rígido; lo que da personalidad al producto es flexible.** Un edificio tiene los cimientos y la estructura fijos, pero la distribución de las habitaciones y la decoración son libres.

> **Regla de interpretación:** si una decisión afecta a la interoperabilidad entre módulos, a la seguridad, al modelo canónico, a la trazabilidad, al ciclo de vida de los datos o al orden de las fases, debe considerarse arquitectónica. Si afecta a una implementación interna sin romper esos contratos, puede resolverse libremente.

---

## 1. Stack tecnológico 🔒 FIJO

Estas tecnologías están decididas y no se sustituyen sin ADR. Introducir una alternativa "porque me gusta más" no es una razón válida.

| Área | Tecnología fija | Notas |
|---|---|---|
| SCM | Git + GitHub | `main` protegida |
| CI/CD + orquestación ETL | GitHub Actions | Batch scheduling con cron |
| Lenguaje de ingesta | Python 3.12 | Versión fijada |
| Gestión de dependencias Python | `uv` | Gestor oficial del proyecto |
| Parseo XML | `lxml` | |
| Cliente HTTP | `httpx` | |
| Validación de datos | Pydantic | |
| Base de datos | PostgreSQL (vía Supabase) | Source of truth |
| Backend gestionado | Supabase | DB + Auth + Storage + Edge Functions |
| Búsqueda (fase 1) | PostgreSQL FTS + GIN + `pg_trgm` | GIST sólo cuando exista un caso de uso justificado |
| Frontend | Next.js + React + TypeScript | |
| Estilos | Tailwind CSS | |
| Hosting web | Vercel | |
| Email | Resend | |
| Móvil (fase posterior) | Kotlin + Jetpack Compose | No en el MVP |

### Infraestructura que no se introduce sin ADR

No introducir por iniciativa propia:

- Redis;
- Elasticsearch/OpenSearch;
- un backend HTTP permanente en Python;
- RabbitMQ/Kafka u otras colas externas;
- proxies de pago;
- otro proveedor de email;
- otro framework de frontend;
- otro ORM como dependencia arquitectónica central;
- un servicio cloud adicional que cambie el modelo de ejecución.

Estas tecnologías pueden introducirse en el futuro únicamente si existe una necesidad medible, una alternativa evaluada y un ADR aprobado.

> **Serverless-first:** la arquitectura inicial evita mantener servidores propios para el procesamiento batch. Esto no significa que la arquitectura sea inmutablemente "100% serverless": si el volumen lo exige, podrán incorporarse workers dedicados sin cambiar el modelo canónico ni la aplicación.

---

## 2. Modelo de repositorio 🔒 FIJO

- **Monorepo único.** Frontend, ETL Python, esquema Supabase, workflows y documentación conviven en el mismo repositorio Git.
- **La estructura de carpetas raíz** es fija:
  - `apps/web/`
  - `packages/`
  - `ingestion/`
  - `supabase/`
  - `docs/`
  - `.github/`
  - `.cursor/`
- 🎨 **LIBRE:** la estructura *interna* de cada módulo queda a criterio propio, siempre respetando los contratos de nivel superior.

### Separación obligatoria de responsabilidades

```text
GitHub
├── código
├── configuración
├── workflows
├── tests
└── documentación

Supabase Storage
└── archivos RAW / artefactos originales

Supabase PostgreSQL
└── modelo canónico + estado operativo

GitHub/Supabase/Vercel secrets
└── secretos y credenciales
```

**GitHub no es la base de datos de EfiLicit.**  
Los datos de contratación no se versionan en Git.

---

## 3. Los principios de arquitectura 🔒 FIJO

Estos once principios son la constitución del proyecto. No se negocian:

1. **Fuente oficial primero.** API/Open Data/feed oficial antes de scraping. Scraping es último recurso.
2. **RAW inmutable.** Se guardan los archivos originales para auditoría y reprocesamiento.
3. **Canonical model.** Todas las fuentes se convierten al mismo modelo interno.
4. **Incrementalidad.** Procesar solo lo nuevo/modificado siempre que la fuente lo permita.
5. **Idempotencia.** Reejecutar un job no duplica ni corrompe datos.
6. **Trazabilidad.** Cada registro se vincula a una fuente, artefacto/fichero y momento de extracción.
7. **DB como source of truth.** PostgreSQL es la verdad operativa; Storage es la evidencia/origen.
8. **Batch-first alerts.** El motor de alertas se diseña por lotes; los webhooks son secundarios.
9. **Security by default.** RLS, secretos fuera del código y mínimo privilegio desde el día 1.
10. **Migration-first.** Toda modificación de esquema pasa por migraciones versionadas.
11. **Evolución controlada.** No añadir infraestructura o proveedores adicionales hasta que exista una necesidad medible.

---

## 4. La regla de oro 🔒 FIJO

> **La aplicación no depende de archivos originales ni de parsers específicos. La web consume el modelo canónico de EfiLicit en PostgreSQL.**

Esto significa que el frontend **nunca** pregunta:

> "¿este campo venía en XML CODICE o en JSON del portal gallego?"

El frontend solo conoce el modelo canónico.

La complejidad específica de cada fuente queda encapsulada en su conector/parsers y no se propaga a la aplicación.

---

## 5. Contrato de conectores ⚠️ FIJO EN EL QUÉ, LIBRE EN EL CÓMO

Todo conector de fuente debe cumplir el contrato específico de acceso a la fuente:

```text
discover()
    ↓
fetch()
    ↓
parse()
```

La plataforma de ingesta, por encima de los conectores, debe ejecutar el pipeline común:

```text
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
```

### 5.1 Responsabilidades

**El conector** sabe hablar con una fuente concreta:

- descubrir artefactos;
- descargarlos;
- parsear su formato;
- manejar sus peculiaridades de acceso.

**El pipeline común** sabe procesar datos de EfiLicit:

- validar;
- guardar RAW;
- normalizar;
- enriquecer;
- resolver entidades;
- deduplicar;
- validar calidad;
- persistir;
- emitir eventos;
- guardar checkpoint.

Esto evita que cada conector implemente su propia versión de la lógica de negocio.

### 5.2 Interfaz conceptual

La interfaz mínima puede ser:

```python
class SourceConnector(Protocol):
    source_code: str

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        ...

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        ...

    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        ...
```

🎨 **LIBRE EN EL CÓMO:** implementación interna, clases auxiliares, estrategia de parseo, paginación, cachés y organización del código.

🔒 **FIJO EN EL QUÉ:** el conector debe ser idempotente y no debe contaminar el modelo canónico con conceptos específicos de su fuente.

### 5.3 Adaptadores por formato: patrón recomendado

El proyecto **favorece** reutilizar adaptadores cuando varias fuentes comparten una estructura técnica y semántica suficientemente común.

Ejemplos de familias:

- CODICE/Atom;
- Socrata;
- JSON-REST;
- CSV.

Pero el formato de transporte por sí solo no obliga a compartir parser.

Dos fuentes JSON pueden necesitar parsers diferentes si su estructura o semántica no es realmente equivalente.

> **Regla:** reutilizar cuando existe compatibilidad real; abstraer por obligación sólo por compartir extensión/formato está desaconsejado.

El catálogo concreto de qué fuentes usan cada adaptador se mantiene en `docs/sources/`, no en este documento de arquitectura fija.

---

## 6. Modelo de datos canónico ⚠️ FIJO EN EL QUÉ, LIBRE EN EL CÓMO

### 6.1 Entidades núcleo

Las entidades y responsabilidades del núcleo son fijas:

- `tenders`
- `tender_sources`
- `tender_events`
- `contracting_authorities`
- `suppliers`
- `documents`
- `users`
- `saved_searches`
- `alerts`
- `notification_queue`
- `source_sync`
- `source_artifacts`
- `errors`

El esquema interno de estas tablas puede evolucionar mediante migraciones compatibles.

### 6.2 Identidad canónica 🔒 FIJO

Para organismos y adjudicatarios:

> **Cuando exista un identificador fiscal fiable (NIF/CIF u otro identificador oficial equivalente), debe utilizarse como señal primaria de identidad.**

**Nunca se utilizará el nombre como identificador único.**

Cuando el identificador fiscal no esté disponible, el sistema utilizará otras señales de matching, por ejemplo:

- nombre normalizado;
- dirección;
- municipio;
- país;
- identificadores de fuente;
- otros identificadores oficiales;
- relaciones históricas.

La resolución debe registrar un nivel de confianza, por ejemplo:

```text
HIGH
MEDIUM
LOW
UNRESOLVED
```

La identidad canónica no debe depender de una única cadena de texto.

### 6.3 Evolución del esquema

⚠️ **Semi-fijo:**

Los campos pueden crecer y ajustarse durante el desarrollo, siempre:

- mediante migración versionada;
- sin tocar producción manualmente;
- preservando trazabilidad;
- sin romper el modelo canónico;
- evitando cambios destructivos sin plan de migración.

🎨 **LIBRE:** tablas auxiliares, cachés, vistas materializadas y estructuras internas que no formen parte del contrato núcleo, siempre que estén documentadas y migradas.

---

## 7. Seguridad 🔒 FIJO

Innegociable, desde el primer día:

- **RLS habilitado** en todas las tablas expuestas.
- Roles de acceso correctamente separados.
- La **service role key nunca** llega al frontend. Solo procesos confiables de backend/CI.
- Los secretos se almacenan en mecanismos de secretos/variables de entorno del entorno correspondiente:
  - GitHub Environments/Secrets;
  - Supabase Secrets;
  - Vercel Environment Variables.
- Nunca almacenar secretos en código ni en `.env` versionado.
- Un usuario nunca accede a alertas, favoritos o información privada de otro usuario.
- Logs sin PII innecesaria.
- Nunca loguear secretos.
- Los accesos internos de ETL deben utilizar el mínimo privilegio compatible con la operación.

### Modelo mental de claves

```text
Frontend
→ publishable/anon key
→ RLS

Usuario autenticado
→ authenticated
→ RLS

ETL / procesos confiables
→ secret/service role sólo donde sea imprescindible
```

La clave de servicio no se utiliza como sustituto de las políticas RLS.

---

## 8. Flujo de base de datos 🔒 FIJO

- Toda modificación de esquema pasa por **migración versionada**.
- **Prohibido** cambiar el esquema de producción a mano desde SQL Editor o Table Editor como mecanismo habitual, una vez adoptadas las migraciones.
- El flujo esperado es:

```text
modificar esquema
    ↓
crear migración
    ↓
probar local
    ↓
CI
    ↓
preview/staging cuando aplique
    ↓
producción
```

- Las migraciones se conservan en `supabase/migrations/`.
- Los cambios destructivos requieren especial revisión y un plan de migración/rollback.
- El esquema remoto y el repositorio deben mantenerse sincronizados.

---

## 9. Orden de implementación 🔒 FIJO (en su columna vertebral)

El orden macro es fijo porque cada fase valida algo que la siguiente necesita:

### 1. Entorno + repositorio + Supabase + migraciones base

Objetivo:

- repositorio funcionando;
- estructura monorepo;
- Supabase CLI;
- migración inicial;
- entorno local reproducible;
- CI mínimo.

### 2. Modelo canónico + `source_sync` + infraestructura mínima de ingesta

Objetivo:

- tablas principales;
- Storage RAW;
- contrato de conectores;
- control de ejecución;
- logs y errores básicos.

### 3. **PLACSP vertical slice** ← hito crítico

Fuente completa, de punta a punta:

```text
fuente
→ descarga
→ RAW
→ parseo
→ normalización
→ persistencia
→ trazabilidad
```

Este hito valida toda la tubería con un caso real.

### 4. Segunda fuente + deduplicación básica

Añadir una segunda fuente distinta y demostrar:

```text
fuente A
+
fuente B
↓
modelo canónico
↓
deduplicación
```

### 5. Búsqueda

Implementar:

- filtros estructurados;
- Full Text Search;
- índices;
- trigramas cuando aporten valor;
- ranking básico.

### 6. Auth + usuarios

Implementar:

- autenticación;
- perfiles;
- RLS;
- favoritos;
- búsquedas guardadas.

### 7. Alertas

Implementar:

```text
alert rule
→ matching
→ notification_queue
→ email/digest
```

### 8. Web / dashboard

Construir la experiencia completa sobre los datos y capacidades ya validados.

### 9. Observabilidad y endurecimiento

Antes del lanzamiento:

- healthchecks;
- métricas;
- errores;
- backups;
- seguridad;
- pruebas de regresión;
- runbooks.

### 10. Escalado y móvil

Sólo después de tener métricas reales:

- workers dedicados;
- motor de búsqueda externo;
- otras infraestructuras;
- aplicación móvil.

🎨 **LIBRE:** dentro de cada fase, el orden de las subtareas y la implementación concreta. Lo que no se puede es saltarse la columna vertebral sin un ADR.

---

## 10. Zonas explícitamente LIBRES 🎨

Aquí hay rienda suelta. Estas decisiones no están acotadas por la arquitectura:

- **Diseño visual y UX de la web:** paleta, tipografía, layout, componentes, microinteracciones, presentación de la ficha, etc.
- **Organización interna del código** dentro de cada módulo.
- **Naming de componentes React, funciones auxiliares y variables locales**, salvo APIs públicas o contratos compartidos.
- **Estrategia concreta de un parser**, mientras cumpla el contrato y sea idempotente.
- **Herramientas de desarrollo personales:** extensiones de editor, snippets, scripts locales de ayuda.
- **Cómo resolver un problema técnico concreto:** algoritmo de matching, forma de construir una query, caché de un cálculo, etc.
- **Mejoras y experimentos** que no rompan las reglas fijas.

La libertad existe para permitir que la persona aprenda y mejore el sistema sin convertir cada decisión de implementación en una reunión de arquitectura.

---

## 11. Qué hacer cuando algo fijo estorba

Ninguna arquitectura es perfecta. Si durante el desarrollo una decisión fija resulta claramente equivocada o limitante:

1. **No se cambia sobre la marcha.**
2. Se reproduce y documenta el problema.
3. Se escribe un **ADR** proponiendo el cambio, con:
   - contexto;
   - problema;
   - decisión propuesta;
   - alternativas;
   - consecuencias;
   - riesgos;
   - evidencia/medición.
4. Se discute con el equipo.
5. Si se aprueba:
   - se actualiza este documento;
   - se crea la migración/cambio correspondiente;
   - el ADR queda como registro histórico del porqué.
6. Se actualiza `CHANGELOG.md` si el cambio afecta al producto o arquitectura publicada.

> **Lo fijo no es fijo para siempre.** Es fijo hasta que exista evidencia suficiente y un ADR aprobado que cambie la decisión.

---

## 12. Dónde se documenta cada tipo de decisión

Para evitar que este documento se convierta en un cajón de sastre:

| Tipo de información | Documento |
|---|---|
| Decisiones estructurales | `01-arquitectura-fija.md` |
| Configuración del entorno | `02-setup-entorno.md` |
| Git / GitHub / Cursor / PRs | `03-git-github-cursor.md` |
| Orden de trabajo / roadmap | `04-roadmap-mvp.md` |
| Una fuente concreta | `docs/sources/<fuente>.md` |
| Decisión arquitectónica nueva | `docs/adr/ADR-XXXX-*.md` |
| Cambios del proyecto | `CHANGELOG.md` |
| Procedimientos operativos | `docs/runbooks/*.md` |
| Reglas para Cursor | `.cursor/rules/*.mdc` |

### Regla de oro documental

> **No meter en un ADR ni en la arquitectura fija información que sólo describe el estado actual de una fuente o de un parser.**

La arquitectura fija define **cómo debe estar diseñado el sistema**.  
El catálogo de fuentes define **cómo es hoy cada fuente**.

---

## 13. Checklist de cumplimiento para Cursor 🔒 FIJO

Antes de aceptar una implementación, Cursor/developer debe poder responder "sí" a estas preguntas:

- ¿Respeta el stack fijado?
- ¿Respeta el contrato del conector?
- ¿Mantiene el modelo canónico?
- ¿Es idempotente?
- ¿Conserva trazabilidad hasta la fuente/artefacto?
- ¿Utiliza RAW cuando corresponde?
- ¿Evita scraping si existe una alternativa oficial mejor?
- ¿Cambia el esquema mediante migración?
- ¿Respeta RLS y secretos?
- ¿Añade tests suficientes?
- ¿Evita una dependencia/servicio nuevo sin ADR?
- ¿Actualiza documentación cuando cambia una decisión?

Si alguna respuesta es "no", la implementación no está terminada.

---

## Resumen de una línea

> **Cimientos rígidos (stack, principios, contratos, seguridad, modelo canónico y orden de fases), implementación libre (UI, organización interna, algoritmos concretos y detalles de cada parser). Ante una duda: si afecta a un contrato entre partes del sistema, es arquitectura; si es una decisión interna reemplazable sin romper ese contrato, es libre.**
