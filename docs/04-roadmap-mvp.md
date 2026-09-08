# 04 — Roadmap hasta el MVP (6 semanas de desarrollo)

> **Estado del documento:** FIJO en la columna vertebral (orden de fases y criterios de salida); LIBRE dentro de cada fase.  
> **Propósito:** Definir el camino de implementación desde el entorno ya montado hasta un MVP funcional de vigilancia de contratación pública española.  
> **Cómo usarlo:** Al empezar cada semana, releer su fase. Al terminar, verificar los criterios de salida antes de avanzar. No se salta una fase crítica sin un ADR/decisión explícita del equipo.

> **Importante:** las 6 semanas son un **objetivo de ejecución**, no una garantía automática de que toda fuente externa estará operativa o de que la cobertura será perfecta. La disponibilidad, formato y calidad de cada fuente pueden introducir trabajo adicional.

---

## 0. Filosofía del roadmap

Cuatro ideas gobiernan este plan:

1. **El motor de conectores es parte central del producto.** El MVP debe demostrar que podemos incorporar muchas fuentes heterogéneas sin duplicar toda la arquitectura para cada una. Se favorece la reutilización de adaptadores cuando exista compatibilidad técnica y semántica real.
2. **Vertical slice primero, luego multiplicar.** Antes de escalar a muchas fuentes, se lleva **una** de punta a punta (PLACSP licitaciones): descubrimiento → descarga → RAW → parseo → modelo canónico → persistencia → trazabilidad. Eso valida la tubería completa.
3. **La deduplicación es obligatoria.** Con fuentes estatales y autonómicas, la misma licitación puede aparecer en varios sitios. El sistema debe representar una licitación canónica con múltiples fuentes, no varias licitaciones independientes. Los identificadores fiscales son señales primarias cuando están disponibles, pero el matching utiliza múltiples señales.
4. **Calidad de datos sobre número de features.** Mejor cobertura fiable, trazable e idempotente que muchas pantallas sobre datos inconsistentes.

---

## 1. El corte del MVP (hasta dónde llegamos)

### Objetivo del MVP

> Una web donde un usuario registrado puede buscar licitaciones de contratación pública española disponibles en las fuentes integradas, con cobertura nacional y autonómica según el catálogo de fuentes del proyecto, datos unificados y deduplicación, guardar criterios de búsqueda y recibir por email nuevas oportunidades que encajen con sus reglas.

### Lo que entra en el MVP

1. **Fuentes estatales (PLACSP):**
   - licitaciones por contratante;
   - contratos menores cuando estén disponibles en la fuente integrada;
   - plataformas agregadas que permitan ampliar cobertura territorial.
2. **Fuentes autonómicas propias priorizadas** según el catálogo de fuentes vigente.
3. **Cobertura territorial de las 17 CCAA:** cada comunidad debe tener identificada al menos una ruta oficial de datos dentro del catálogo del proyecto. La fuente puede ser propia o una fuente agregada si realmente ofrece los datos necesarios.
4. **Modelo de datos canónico** poblado con datos reales.
5. **Deduplicación** mediante identificadores de fuente, expediente, organismo y otras señales; NIF/CIF como señal primaria cuando exista.
6. **Buscador** con filtros + Full Text Search + tolerancia a erratas.
7. **Autenticación** de usuarios con RLS verificado.
8. **Motor de alertas** batch + `notification_queue` + email con Resend.
9. **Web** con búsqueda, ficha de licitación, alertas y dashboard básico.
10. **Observabilidad mínima** de fuentes: `source_sync`, logs y healthchecks.

### Definición de cobertura

> "Cobertura de una comunidad autónoma" no significa "hemos capturado absolutamente todos los contratos de todos los organismos locales". Significa que existe al menos una fuente oficial integrada que cubre el ámbito objetivo definido por el proyecto y que la fuente está documentada en `docs/sources/`.

### Lo que NO entra en el MVP

- **Subvenciones** (BDNS, RAISC y datasets autonómicos de ayudas).
- App móvil.
- TED como fuente de contratación europea.
- Motor de búsqueda externo (Elasticsearch/OpenSearch).
- Scoring semántico/IA en alertas.
- Integraciones/webhooks hacia terceros.
- Infraestructura adicional que no haya demostrado una necesidad real.
- Automatización avanzada de revisión humana de matches ambiguos.

---

## 2. El catálogo de fuentes: `contratacionabierta.com`

Existe un recurso muy útil para descubrir fuentes oficiales: **[contratacionabierta.com](https://contratacionabierta.com/)**.

Debe utilizarse como **catálogo de referencia**, no como garantía de que contenga absolutamente todas las fuentes posibles ni como sustituto de la documentación oficial de cada organismo.

### Regla de mantenimiento

La lista concreta de:

- CCAA;
- URLs;
- formatos;
- APIs;
- datasets;
- frecuencia;
- método incremental;
- adaptador utilizado;

se mantiene en:

```text
docs/sources/
```

y **no se congela en este roadmap**.

Esto evita que el roadmap quede obsoleto cuando una comunidad cambie de API, formato o portal.

### Repo de referencia

El proyecto open source `dcarrero/contratacion-publica-abierta` puede utilizarse como referencia de diseño para:

- modelos de datos;
- normalización;
- organización de sincronizaciones.

No se copia código ni se incorpora una dependencia por el mero hecho de existir. Cualquier reutilización debe respetar licencia y pasar revisión.

---

## 3. Semana 0 — Setup (fuera del tiempo de desarrollo)

Esta fase la realiza el equipo antes de arrancar el desarrollo. **No cuenta como tiempo de las 6 semanas.**

Queda listo antes de empezar la Semana 1:

- Todas las herramientas instaladas conforme a `02-setup-entorno.md`.
- Repositorio `efilicit` creado con el árbol de carpetas definido.
- `.cursor/rules/` configuradas.
- Supabase local funcionando.
- Proyecto Supabase remoto vinculado.
- Esquema remoto capturado con `supabase db pull` y revisado.
- Versión mayor de PostgreSQL local alineada con la remota.
- `seed.sql` de desarrollo definido cuando aplique.
- GitHub configurado: repo, ramas protegidas, Environments/Secrets.
- `.env.example`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md` creados.
- Web arrancando en blanco.
- CLI de ingesta respondiendo `--help`.
- `supabase db reset` funciona en local.
- RLS y Storage básicos preparados para el entorno local.

### Punto de partida

> **Entorno funcional, repo vivo, Supabase reproducible y migraciones controladas.**

El desarrollo empieza directamente por el modelo de datos y la maquinaria de ingesta.

---

## 4. Vista general de las 6 semanas de desarrollo

| Semana | Fase | Entregable principal | Fijo | Libre |
|---|---|---|---|---|
| 1 | Modelo canónico + infraestructura de ingesta | DB canónica + contratos + `source_sync` + infraestructura mínima | Modelo, contratos, migraciones | Organización interna |
| 2 | PLACSP vertical slice | Fuente estatal de punta a punta | Idempotencia, RAW, trazabilidad | Diseño del parser |
| 3 | Escalado estatal + primeras CCAA | Menores/agregadas + primeras CCAA reales | Reuso, trazabilidad | Implementación adaptadores |
| 4 | Cobertura territorial + deduplicación | Rutas de datos de las 17 CCAA + dedup funcional | Dedup, trazabilidad | Algoritmo y thresholds |
| 5 | Búsqueda + Auth + Alertas | Buscador + login/RLS + alertas | FTS, RLS, batch-first | UX, ranking fino |
| 6 | Web + hardening | Flujo integrado + observabilidad | End-to-end, seguridad | Diseño visual |

### Regla de alcance

El objetivo es llegar al mayor nivel de cobertura fiable posible dentro de las seis semanas.

Si una fuente autonómica resulta inesperadamente compleja:

1. no degradar PLACSP;
2. no desactivar deduplicación;
3. no saltarse seguridad;
4. documentar el bloqueo;
5. priorizar la siguiente fuente con mejor relación cobertura/esfuerzo;
6. registrar lo pendiente para después del MVP.

---

## 5. Semana 1 — Modelo canónico + infraestructura de ingesta

**Meta:** tener la base canónica migrada y la maquinaria común preparada para implementar fuentes sin inventar una arquitectura nueva en cada una.

### Tareas

- Diseñar y migrar el modelo:
  - `tenders`
  - `tender_sources`
  - `tender_events`
  - `contracting_authorities`
  - `suppliers`
  - `documents`
  - `source_sync`
  - `source_artifacts`
  - `errors`
  - esqueleto de `users`
  - `saved_searches`
  - `alerts`
  - `notification_queue`
- Definir identidad canónica usando NIF/CIF u otro identificador oficial equivalente **cuando exista**.
- Definir la interfaz `SourceConnector` mínima:
  - `discover`
  - `fetch`
  - `parse`
- Definir el pipeline común:
  - `validate_artifact`
  - `store_raw`
  - `normalize`
  - `enrich`
  - `resolve_identity`
  - `deduplicate`
  - `quality_checks`
  - `upsert`
  - `emit_events`
  - `checkpoint`
- Crear esqueletos de adaptadores/formato sólo cuando haya una necesidad real.
- Modelar `source_sync` con contadores y estado.
- Modelar `source_artifacts` con checksum y trazabilidad.
- Crear los ADR iniciales necesarios.

### 🔒 Fijo

- Modelo canónico y sus responsabilidades.
- Contrato de conector.
- Separación conector/pipeline.
- Migraciones versionadas.
- Trazabilidad.
- Idempotencia.

### 🎨 Libre

- Organización interna.
- Utilidades.
- Implementación de clases.
- Estructura interna de adaptadores.

### ✅ Criterio de salida

- `supabase db reset` reconstruye la DB sin errores.
- Existen las tablas/índices iniciales necesarios.
- `SourceConnector` compila y tiene tests básicos.
- El pipeline común tiene una prueba mínima.
- `source_sync` y `source_artifacts` están funcionando.
- ADRs estructurales escritos.

---

## 6. Semana 2 — PLACSP vertical slice

**Meta:** llevar la fuente prioritaria de PLACSP de punta a punta. Este es el hito crítico.

### Contexto

PLACSP es el primer caso real porque obliga a demostrar:

- acceso;
- manejo de artefactos;
- parseo XML;
- normalización;
- persistencia;
- trazabilidad;
- idempotencia.

No es necesario implementar desde el principio todos los campos posibles del estándar. Sólo los necesarios para el modelo canónico y el MVP.

### Tareas

- Implementar `discover`.
- Implementar `fetch` con:
  - timeout;
  - retry;
  - control de tamaño;
  - checksum.
- Validar artefactos antes de procesarlos.
- Guardar RAW en Supabase Storage.
- Implementar parseo con `lxml` y procesamiento en streaming cuando sea necesario.
- Normalizar:
  - fechas;
  - importes;
  - estados;
  - CPV;
  - geografía;
  - organismos.
- Resolver identidad de organismos usando NIF/CIF cuando exista; si no, aplicar otras señales.
- Upsert determinista por `source_code + source_id`.
- Registrar:
  - `tender_sources`;
  - `tender_events`;
  - `documents`;
  - `source_sync`;
  - `source_artifacts`.
- Workflow `ingest-placsp.yml`.
- Fixtures y tests de regresión.
- Probar reejecución completa.

### 🔒 Fijo

- Contrato del conector.
- Idempotencia.
- RAW inmutable con checksum.
- Trazabilidad.
- Modelo canónico.
- No perder información crítica por una abstracción prematura.

### 🎨 Libre

- Diseño interno del parser.
- Estructuras intermedias.
- Estrategia de mapeo.
- Optimización de memoria.

### ✅ Criterio de salida

- El pipeline completo puebla `tenders` con datos reales de PLACSP.
- Reejecutar no duplica.
- Una licitación puede trazarse hasta su artefacto RAW.
- `source_sync` refleja la ejecución.
- Tests de parser, normalización y persistencia pasan.

> **Hito crítico:** si este vertical slice no es sólido, no multiplicar fuentes.

---

## 7. Semana 3 — Escalado estatal + primeras CCAA

**Meta:** reutilizar la maquinaria validada.

### Tareas

- Reutilizar el adaptador/plataforma de PLACSP para las sindicaciones estatales que formen parte del alcance del MVP y que tengan estructura compatible.
- Implementar el primer adaptador CSV genérico si existe una familia de fuentes realmente compatible.
- Implementar el primer adaptador API REST/Socrata cuando corresponda.
- Añadir las primeras CCAA con mejor relación cobertura/esfuerzo.
- Cada nueva fuente debe tener:
  - documentación en `docs/sources/`;
  - `source_sync`;
  - fixture;
  - tests;
  - configuración de acceso;
  - workflow o job correspondiente.

### 🔒 Fijo

Cada fuente debe:

- respetar el contrato común;
- ser idempotente;
- ser trazable;
- guardar RAW;
- evitar scraping si hay acceso oficial mejor.

### 🎨 Libre

- diseño del adaptador;
- configuración por fuente;
- estrategia de paginación;
- mapeos.

### ✅ Criterio de salida

- Las fuentes estatales priorizadas del MVP están ingiriendo correctamente.
- Varias CCAA propias están ingiriendo datos reales.
- Cada fuente añadida tiene tests y `source_sync`.
- No se ha creado un modelo de datos alternativo por fuente.

---

## 8. Semana 4 — Cobertura territorial + deduplicación

**Meta:** alcanzar la cobertura territorial objetivo definida para el MVP y demostrar deduplicación funcional.

### Tareas — Cobertura

- Añadir las CCAA propias restantes según `docs/sources/`.
- Verificar para cada CCAA:
  - fuente;
  - cobertura;
  - última actualización;
  - mecanismo incremental;
  - estado de sincronización.
- Verificar qué comunidades reciben cobertura mediante una fuente agregada y qué limitaciones tiene esa cobertura.
- Registrar cualquier hueco real en `docs/sources/`.

### Tareas — Deduplicación

Implementar `resolve_identity` / matching por niveles:

1. identificador exacto de fuente;
2. expediente + organismo;
3. otras combinaciones fiables:
   - CPV;
   - importe;
   - fechas;
   - organismo;
   - ubicación;
4. similitud de título/objeto.

Registrar:

```text
canonical_tender_id
source_code
source_tender_id
match_method
match_score
matched_at
review_status
```

### Regla de identidad

El NIF/CIF es una señal primaria cuando está disponible.

No se puede convertir la deduplicación en:

```text
mismo nombre = mismo organismo
```

### Casos ambiguos

**No fusionar automáticamente** cuando la confianza sea insuficiente.

Registrar el caso para revisión:

```text
review_status = pending
```

### 🔒 Fijo

- deduplicación obligatoria;
- trazabilidad;
- no fusionar ambigüedades a ciegas;
- múltiples fuentes pueden apuntar al mismo `canonical_tender_id`.

### 🎨 Libre

- algoritmo concreto;
- pesos;
- thresholds;
- presentación de casos.

### ✅ Criterio de salida

- Las 17 CCAA tienen una ruta de fuente identificada dentro del alcance.
- Las fuentes integradas muestran datos reales.
- Una licitación presente en dos fuentes compatibles se representa una sola vez cuando el algoritmo tiene suficiente confianza.
- Los casos ambiguos quedan pendientes de revisión.
- Tests de dedup en verde.

> **Importante:** "17 CCAA cubiertas" significa que cada comunidad tiene una ruta de datos oficial integrada o una fuente agregada documentada. No significa que el MVP garantice el 100 % de todos los contratos de todas las entidades locales de cada comunidad.

---

## 9. Semana 5 — Búsqueda + Autenticación + Alertas

**Meta:** que un usuario pueda registrarse, buscar sobre los datos unificados y recibir alertas por email.

### Tareas — Búsqueda

- Columna `search_vector` (`tsvector`) donde tenga sentido.
- Peso de campos:
  - título > objeto/descripción.
- Índice GIN.
- `pg_trgm` para erratas/similitud.
- B-tree para:
  - fecha;
  - importe;
  - estado;
  - CPV;
  - geografía.
- Queries centralizadas en `apps/web/lib/queries`.
- Sin motor externo.

### Tareas — Auth

- Supabase Auth.
- `users` ligado a `auth_user_id`.
- `saved_searches`.
- `alerts`.
- RLS verificado explícitamente.

### Tareas — Alertas

```text
NEW/UPDATED
    ↓
match
    ↓
score
    ↓
priority
    ↓
dedupe
    ↓
notification_queue
```

Definición de alerta:

- keywords;
- CPV;
- organismo;
- geografía;
- importe min/max;
- tipo de contrato;
- frecuencia.

`notification_queue` debe incluir como mínimo:

- estado;
- `idempotency_key`;
- intentos;
- timestamps;
- error.

Resend se integra mediante el mecanismo backend/Edge Function definido por el proyecto.

Frecuencia mínima inicial:

> **digest diario**.

La modalidad instantánea puede incorporarse si queda establecida como parte del alcance del MVP.

### 🔒 Fijo

- FTS + GIN + `pg_trgm`;
- RLS;
- service role fuera del frontend;
- alertas batch-first;
- cola idempotente;
- no email por cada INSERT bruto.

### 🎨 Libre

- UX;
- ranking fino;
- diseño del email;
- scoring;
- nombres y organización de componentes.

### ✅ Criterio de salida

- La búsqueda de términos normales devuelve resultados relevantes.
- Una errata razonable produce resultados si `pg_trgm` la cubre.
- Un usuario no accede a datos privados de otro.
- Crear una alerta → ejecutar batch → recibir email.
- Reejecutar el batch no reenvía notificaciones ya enviadas.

---

## 10. Semana 6 — Web integrada + cierre

**Meta:** integrar las piezas validadas en una experiencia web coherente y endurecer el sistema.

### Tareas — Web

- Integrar:
  - buscador;
  - ficha de licitación;
  - múltiples fuentes de una misma licitación;
  - favoritos/seguimiento;
  - gestión de alertas;
  - dashboard básico.
- estados de carga;
- estados vacíos;
- errores;
- responsive;
- flujo:
  - buscar;
  - guardar;
  - alertar;
  - recibir email.

### Tareas — Hardening

- RLS en todas las tablas expuestas.
- Sin secretos en código.
- Healthchecks por fuente.
- CI verde:
  - lint;
  - typecheck;
  - tests;
  - build.
- CHANGELOG actualizado.
- ADRs al día.
- Runbooks mínimos:
  - `source-down.md`;
  - `reprocess-source-date.md`;
  - `replay-artifact.md` cuando el pipeline ya lo soporte.

### 🔒 Fijo

Flujo end-to-end sobre datos reales y seguridad no opcional.

### 🎨 Libre

Todo el diseño de la web.

### ✅ Criterio de salida (MVP completo)

- Un usuario se registra.
- Busca licitaciones integradas.
- Consulta la ficha.
- Guarda una búsqueda.
- Crea una alerta.
- Recibe un email.
- Las fuentes integradas se ejecutan programadamente.
- Los jobs son idempotentes.
- Existe trazabilidad hasta RAW.
- Seguridad y CI están revisados.
- La documentación está al día.

---

## 11. Definition of Done (aplica a cada tarea)

- [ ] Compila y linta sin errores.
- [ ] Tests unitarios/integración relevantes pasan.
- [ ] Migración SQL si se tocó la DB.
- [ ] RLS revisado si se tocó una tabla expuesta.
- [ ] Sin secretos hardcodeados.
- [ ] CI en verde.
- [ ] CHANGELOG actualizado cuando el cambio lo requiera.
- [ ] ADR creado si hubo decisión arquitectónica.
- [ ] Documentación de fuente actualizada si es un conector.
- [ ] Fixtures añadidos si es un parser.
- [ ] `source_sync` actualizado si es una ingesta.
- [ ] Trazabilidad RAW → canonical preservada.
- [ ] Logs/métricas suficientes para diagnosticar un fallo.

---

## 12. Riesgos del roadmap y cómo mitigarlos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Parser PLACSP consume más de la Semana 2 | Alta | Reducir el primer alcance a los campos canónicos del MVP; no intentar modelar todo CODICE desde el principio |
| Deduplicación se vuelve demasiado compleja | Alta | Resolver primero coincidencias de alta confianza; mandar ambigüedad a revisión |
| Faltan identificadores fiscales en fuentes | Media | Matching multiseñal + confidence score; no depender exclusivamente de NIF/CIF |
| Cada CCAA tiene estructuras distintas | Alta | Reutilizar adaptadores sólo cuando exista compatibilidad real; mapeos declarativos donde sea útil |
| Se sacrifica calidad estatal por abarcar demasiadas fuentes | Media | Prioridad sagrada: PLACSP, modelo canónico y dedup |
| Una fuente cambia formato | Media | Fixtures + contract tests + healthchecks + documentación de fuente |
| Una fuente parece integrada pero deja de actualizar | Media | `source_sync`, métricas de volumen y alertas de freshness |
| Las 6 semanas se quedan cortas | Media | Recortar features o fuentes secundarias; no recortar seguridad, trazabilidad, calidad ni vertical slice |
| GitHub Actions se queda corto por volumen | Baja/condicional | Medir consumo; escalar sólo la capa de workers si es necesario; no cambiar DB/app por ello |

---

## 13. Después del MVP (fuera de las 6 semanas)

- **Subvenciones:** BDNS, RAISC y datasets autonómicos.
- **TED** y contratación europea.
- Deduplicación avanzada y revisión asistida.
- Web push y más canales.
- Observabilidad completa.
- App móvil con Kotlin/Compose.
- Motor semántico/IA.
- Motor de búsqueda externo si las métricas lo justifican.
- Integraciones/webhooks hacia terceros.
- Workers dedicados si la ingesta deja de ser eficiente en GitHub Actions.

---

## Resumen de una línea

> **Seis semanas: una para el modelo canónico y la maquinaria de ingesta, una para PLACSP de punta a punta (hito crítico), una para escalar fuentes estatales y primeras CCAA, una para completar la cobertura territorial objetivo y deduplicar, una para búsqueda + Auth + alertas y una para integrar la web y endurecer el sistema. El listón del MVP no es "tener muchas pantallas": es poder encontrar, identificar, rastrear y vigilar licitaciones reales con datos fiables y alertas reproducibles.**
