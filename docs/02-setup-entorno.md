# 02 — Setup del entorno (de cero a funcional)

> **Estado del documento:** FIJO en los pasos y herramientas; LIBRE en el sistema operativo y editor personal.  
> **Propósito:** Llevar una máquina desde cero hasta un entorno EfiLicit completamente funcional, con Supabase local corriendo y el repo listo para desarrollar, sin tocar producción accidentalmente.  
> **Tiempo estimado:** 1–2 horas la primera vez; la mayor parte corresponde a descargas de herramientas e imágenes Docker.

---

## 0. Antes de empezar: qué vamos a montar

Al terminar este documento, la máquina tendrá:

- Las herramientas base instaladas:
  - Git;
  - Docker Desktop / Docker Engine;
  - Node.js en la versión fijada por el repositorio;
  - pnpm en la versión fijada por el repositorio;
  - Python 3.12.x;
  - uv;
  - Supabase CLI;
  - Cursor.
- El monorepo `efilicit` clonado y abierto en Cursor.
- El stack de Supabase corriendo **en local** dentro de Docker:
  - PostgreSQL;
  - Auth;
  - Storage;
  - API;
  - Studio.
- El proyecto local vinculado al proyecto Supabase remoto existente.
- El esquema remoto capturado en migraciones versionadas y revisado.
- La versión mayor de PostgreSQL local alineada con la de producción.
- Un `seed.sql` local con datos sintéticos de desarrollo, cuando el proyecto lo utilice.
- Las variables de entorno locales configuradas a partir de las plantillas.
- La web arrancando en local y conectando contra Supabase local.
- El CLI de ingestion respondiendo.
- Una comprobación básica de Auth/RLS y Storage realizada localmente.

### Principio rector

> **Nada se toca en producción a mano como parte del setup.**

Se trabaja en local. El esquema remoto se captura mediante `supabase db pull`, los cambios se hacen con migraciones y el despliegue se controla mediante CI/CD.

---

## 1. Herramientas base 🔒 FIJO

Las versiones de runtime deben quedar **fijadas por el repositorio**. No usar rangos abiertos como "20+" o "9+" una vez decidido el `package.json`.

| Herramienta | Versión / política | Para qué |
|---|---|---|
| Git | Versión reciente estable | Control de versiones |
| Docker Desktop / Engine | Versión reciente estable | Stack local de Supabase |
| Node.js | Versión LTS fijada por el repo | Next.js |
| pnpm | Versión fijada por el repo | Gestor de paquetes |
| Python | 3.12.x | Motor de ingesta |
| uv | Versión reciente compatible | Gestión Python |
| Supabase CLI | Versión reciente compatible | Migraciones + stack local |
| Cursor | Versión reciente | IDE |

### Cómo se fijan Node y pnpm

El repositorio debe declarar la versión de Node y pnpm.

Ejemplo conceptual:

```json
{
  "engines": {
    "node": "22.x"
  },
  "packageManager": "pnpm@9.x.x"
}
```

La versión exacta utilizada debe ser la que figure en el repositorio, no la que el desarrollador elija por su cuenta.

### Python

Python debe ser **3.12.x**. No es necesario que la máquina utilice exactamente el mismo parche que otra persona, pero sí la misma major/minor:

```text
3.12.x
```

La versión exacta puede quedar fijada adicionalmente en la configuración del proyecto Python.

### 🎨 LIBRE

- macOS, Linux o Windows + WSL2;
- nvm/fnm/pyenv u otro gestor;
- extensiones personales de Cursor;
- terminal preferido.

### Nota sobre Windows

Si se trabaja en Windows, se recomienda **WSL2 con Ubuntu** para el entorno de desarrollo. Docker Desktop puede integrarse con WSL2.

No es obligatorio, pero reduce fricción en Python, Docker y herramientas de línea de comandos.

### Requisitos de Docker

El stack local de Supabase ejecuta varios servicios y puede consumir una cantidad importante de memoria. Se recomienda asignar suficiente RAM al runtime de Docker según los requisitos actuales de Supabase; como referencia práctica, reservar alrededor de **7 GB o más** para el entorno de contenedores.

### Verificación rápida

```bash
git --version
docker --version
node --version
pnpm --version
python --version
uv --version
supabase --version
```

Comprobar:

```text
Node      → versión indicada por el repo
pnpm      → versión indicada por el repo
Python    → 3.12.x
```

Y comprobar que Docker está arrancado:

```bash
docker info
```

---

## 2. Instalación de Supabase CLI 🔒 FIJO

No instalar el CLI de una forma que introduzca una dependencia global obsoleta o distinta del estándar del proyecto.

Elegir una de las vías soportadas por el sistema operativo o por el proyecto, siguiendo la documentación oficial actual de Supabase.

Ejemplos:

### macOS / Linux

```bash
brew install supabase/tap/supabase
```

### Dependencia del proyecto

También puede mantenerse Supabase CLI como dependencia de desarrollo y ejecutarse mediante el package manager del proyecto.

Por ejemplo:

```bash
pnpm add -D supabase
```

y luego:

```bash
pnpm supabase <comando>
```

### Regla

El equipo debe decidir **una sola vía oficial para este repositorio** y documentarla en `CONTRIBUTING.md` / `README.md`.

No mezclar instalaciones de CLI entre miembros del equipo sin necesidad.

---

## 3. Clonar el repositorio

```bash
git clone <URL_DEL_REPO_EFILICIT>
cd efilicit
```

Comprobar:

```bash
git status
```

Debe aparecer el repositorio limpio.

Abrir la carpeta en Cursor.

En este punto, Cursor debe poder indexar:

```text
docs/
.cursor/
apps/
ingestion/
supabase/
.github/
```

Si el repo ya tiene la arquitectura creada, **no ejecutar `supabase init` de nuevo**.

> `supabase init` sólo se utiliza cuando el repositorio todavía no tiene la carpeta `supabase/`.

---

## 4. Instalar dependencias del monorepo

### 4.1 Frontend

Desde la raíz:

```bash
pnpm install
```

El repositorio debe utilizar el `packageManager` fijado en `package.json`.

No actualizar automáticamente las versiones principales de Node/pnpm para "probar algo" durante el setup.

### 4.2 Ingesta Python

```bash
cd ingestion
uv sync
cd ..
```

`uv sync` crea/actualiza el entorno virtual conforme a `pyproject.toml` y al lockfile del proyecto.

**No usar pip manualmente para instalar dependencias del proyecto.**

Las dependencias se modifican desde `pyproject.toml`/lockfile y pasan por revisión.

### 4.3 Comprobación

```bash
cd ingestion
uv run python -c "import sys; print(sys.version)"
cd ..
```

La salida debe ser Python 3.12.x.

---

## 5. Preparar y arrancar Supabase en local 🔒 FIJO

Supabase local se ejecuta mediante Docker.

### 5.1 Si el repo ya contiene `supabase/`

No ejecutar `supabase init`.

Comprobar:

```text
supabase/
├── config.toml
├── migrations/
├── seed.sql
└── functions/
```

### 5.2 Si el repo todavía no contiene `supabase/`

Sólo entonces:

```bash
supabase init
```

### 5.3 Arrancar Supabase

Con Docker arrancado:

```bash
supabase start
```

El stack local incluirá los servicios necesarios de Supabase, como:

```text
Docker
└── Supabase local
    ├── PostgreSQL
    ├── Auth
    ├── Storage
    ├── API
    └── Studio
```

Comprobar:

```bash
supabase status
```

### 5.4 Studio

La CLI mostrará la URL de Studio local. En la configuración estándar suele ser:

```text
http://localhost:54323
```

Usar la URL que indique `supabase status` si difiere.

> El stack local **no debe exponerse públicamente**. Es únicamente para desarrollo.

---

## 6. Seed local 🔒 FIJO

El repositorio puede tener:

```text
supabase/seed.sql
```

El `seed.sql` contiene **datos sintéticos o datos de prueba controlados** para facilitar el desarrollo local.

Nunca se debe copiar a `seed.sql`:

- usuarios reales;
- tokens;
- contraseñas;
- secretos;
- información sensible real innecesaria;
- datos de producción que no tengan autorización expresa para desarrollo.

### ¿Qué ocurre al hacer `supabase db reset`?

Conceptualmente:

```text
DB local actual
    ↓
se elimina / reconstruye
    ↓
se aplican migraciones
    ↓
se ejecuta seed.sql
    ↓
DB local reproducible
```

`supabase db reset` actúa sobre la base **local**.

### ⚠️ Nunca confundir con:

```bash
supabase db reset --linked
```

No ejecutar el modo vinculado sobre producción. Es una operación potencialmente destructiva.

---

## 7. Vincular el repositorio al proyecto Supabase remoto existente 🔒 FIJO

Este paso sólo se hace con el proyecto Supabase real que ya existe.

**No crear otro proyecto Supabase para EfiLicit.**

### 7.1 Autenticarse

```bash
supabase login
```

El proceso abrirá el navegador y generará la autenticación necesaria para el CLI.

### 7.2 Vincular el proyecto

```bash
supabase link --project-ref <PROJECT_REF>
```

El `<PROJECT_REF>` identifica el proyecto remoto.

No es un secreto y puede mantenerse como identificador de configuración/control.

Las credenciales secretas de la base de datos no se guardan en el repositorio.

### 7.3 Capturar el esquema remoto

Una vez vinculado:

```bash
supabase db pull
```

Esto genera una migración que representa el estado remoto actual.

### 7.4 Revisar la migración

**No hacer commit inmediatamente.**

Revisar la migración generada y comprobar:

- tablas;
- índices;
- funciones;
- extensiones;
- políticas;
- triggers;
- objetos de Auth/Storage si aplican;
- artefactos que no deberían entrar en el código de la aplicación.

Si existen personalizaciones de esquemas de Supabase que requieran una captura específica, realizar los pulls de esquema correspondientes según la configuración del proyecto.

### 7.5 Comprobar historial de migraciones

```bash
supabase migration list
```

Debe permitir detectar diferencias entre migraciones locales y el historial remoto.

### 7.6 Comprobar versión mayor de PostgreSQL

La versión mayor de PostgreSQL local debe coincidir con la de producción.

Comprobar la versión del remoto según el procedimiento del equipo/Supabase y verificar la configuración:

```text
supabase/config.toml
```

El valor de `db.major_version` debe ser compatible con producción.

> **No iniciar una migración importante mientras local y remoto utilicen majors incompatibles.**

---

## 8. La regla crítica de aquí en adelante 🔒 FIJO

Una vez adoptadas las migraciones versionadas:

> **NO se cambia el esquema de producción a mano desde SQL Editor o Table Editor como mecanismo habitual.**

El flujo normal es:

```bash
supabase migration new <nombre_descriptivo>
```

Editar el SQL generado.

Después:

```bash
supabase db reset
```

para reconstruir la base local desde cero.

Probar.

Después:

```bash
supabase migration list
```

y ejecutar CI antes de aplicar a producción.

El despliegue remoto se realiza de forma controlada:

```bash
supabase db push
```

o mediante el workflow CI/CD definido por el proyecto.

### Regla crítica de seguridad

**Nunca utilizar comandos destructivos contra el proyecto remoto durante el setup local.**

Especialmente:

```bash
supabase db reset --linked
```

no debe utilizarse contra producción.

---

## 9. Variables de entorno

El repositorio debe separar claramente:

```text
apps/web/.env.local
```

de los secretos necesarios para Python/ingesta y de los secretos de CI.

### Frontend local

Ejemplo:

```text
apps/web/.env.local
```

con variables como:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

### Ingesta local

Los secretos que necesite Python deben proporcionarse mediante el mecanismo de configuración local definido por el proyecto.

### CI

Los workflows usan:

```text
GitHub Environments / Secrets / Variables
```

### Supabase Edge Functions

Sus secretos se mantienen en el mecanismo de secretos de Supabase.

### Variables de referencia

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SERVICE_ROLE_KEY=      # SOLO procesos confiables
SUPABASE_DB_URL=                # si el proceso realmente lo necesita
SUPABASE_PROJECT_REF=           # identificador, no secreto

RESEND_API_KEY=
ALERT_FROM_EMAIL=

SOURCE_*_API_KEY=               # sólo si una fuente lo requiere
```

### Reglas de seguridad 🔒 FIJO

- La publishable key puede estar en frontend si RLS está correctamente configurado.
- La service role key **NUNCA** se expone al navegador.
- Los secretos no se guardan en Git.
- `.env.local` y cualquier fichero local con valores reales debe estar en `.gitignore`.
- El único archivo versionado es la plantilla sin secretos:

```text
.env.example
```

- Los secretos de producción viven en GitHub/Supabase/Vercel según el componente.

---

## 10. Storage RAW local

La arquitectura de EfiLicit utiliza Supabase Storage para conservar los artefactos RAW.

El setup debe verificar que el proyecto local tiene el bucket/configuración necesarios.

Ejemplo conceptual:

```text
raw/
├── placsp/
├── ted/
├── ccaa/
└── ...
```

### Regla de acceso

El frontend de un usuario normal **no escribe directamente en el bucket RAW**.

La escritura de RAW la realiza el proceso de ingesta confiable.

Las políticas de Storage deben reflejar este modelo.

### Verificación

Desde el entorno local:

- comprobar que Storage está disponible;
- comprobar que el bucket esperado existe o puede crearse mediante migración/configuración;
- comprobar las políticas;
- comprobar que un usuario normal no puede escribir RAW directamente.

---

## 11. Generación de tipos TypeScript

El modelo de PostgreSQL es la fuente de verdad del frontend.

Cuando el esquema esté disponible localmente, generar tipos TypeScript desde Supabase:

```bash
supabase gen types typescript --local > packages/types/src/database.types.ts
```

La ruta exacta puede variar según el árbol definitivo del repositorio, pero el principio es fijo:

```text
PostgreSQL
    ↓
supabase gen types
    ↓
tipos TypeScript
    ↓
Next.js
```

Los tipos generados deben mantenerse sincronizados cuando cambie el esquema.

No duplicar manualmente en TypeScript un modelo de DB que el generador puede producir.

---

## 12. Arrancar el frontend en local

```bash
cd apps/web
pnpm dev
```

Abrir:

```text
http://localhost:3000
```

La aplicación debe conectar contra:

**Supabase local**, no producción.

Comprobar:

```text
Next.js
   ↓
Supabase local
   ↓
PostgreSQL local
```

### Verificación mínima de la aplicación

No basta con que la página cargue.

Debe comprobarse al menos:

- una consulta a la DB local;
- autenticación local si está implementada;
- una operación protegida por RLS.

---

## 13. Prueba de Auth y RLS 🔒 FIJO

Antes de considerar el entorno listo, realizar una prueba mínima de autorización.

Ejemplo conceptual:

```text
Usuario A
  ↓
lee su alerta
  ✅

Usuario A
  ↓
intenta leer alerta de Usuario B
  ❌
```

La prueba exacta depende de las tablas que ya existan, pero el objetivo es demostrar que RLS está realmente funcionando.

### Regla

> Una aplicación que funciona localmente pero no ha demostrado el comportamiento de RLS todavía no tiene un entorno validado.

---

## 14. Verificación final: ¿está todo funcionando?

Checklist:

- [ ] Git funciona.
- [ ] Docker funciona.
- [ ] Node usa la versión fijada por el repositorio.
- [ ] pnpm usa la versión fijada por el repositorio.
- [ ] Python es 3.12.x.
- [ ] uv funciona.
- [ ] Supabase CLI funciona.
- [ ] `supabase status` muestra servicios locales.
- [ ] Docker tiene suficiente memoria asignada.
- [ ] Supabase Studio local abre.
- [ ] El repo está vinculado al proyecto remoto correcto.
- [ ] Existe migración base capturada con `supabase db pull`.
- [ ] La migración base ha sido revisada.
- [ ] `supabase migration list` no muestra una situación desconocida.
- [ ] PostgreSQL local y remoto tienen la misma major version.
- [ ] `supabase db reset` reconstruye la DB local sin errores.
- [ ] `seed.sql` se ejecuta cuando corresponda.
- [ ] Storage local funciona.
- [ ] Las políticas de Storage son coherentes.
- [ ] Auth local funciona si ya está implementado.
- [ ] RLS local se ha probado.
- [ ] `supabase gen types` genera tipos correctamente.
- [ ] `pnpm dev` levanta la web.
- [ ] La web consulta Supabase local.
- [ ] `uv run python -m efilicit_ingestion.cli --help` responde.
- [ ] `.env.local` y otros secretos locales no están en Git.
- [ ] `git status` no muestra secretos ni archivos temporales.

Si todos los puntos pasan, el entorno está listo para comenzar la Fase 0 del roadmap.

---

## 15. Flujo diario después del setup

Una vez terminado el onboarding, el desarrollo normal será:

```text
trabajo en rama
    ↓
código
    ↓
migración si cambia DB
    ↓
tests
    ↓
supabase db reset
    ↓
validar local
    ↓
commit
    ↓
Pull Request
    ↓
CI
    ↓
Preview
    ↓
merge
    ↓
producción mediante CI/CD
```

La persona no debería necesitar tocar producción manualmente para desarrollar funcionalidades normales.

---

## 16. Comandos útiles del día a día

```bash
# Estado de Supabase local
supabase status

# Arrancar
supabase start

# Parar
supabase stop

# Reconstruir DB LOCAL desde cero
supabase db reset

# Crear migración
supabase migration new <nombre>

# Ver historial local/remoto
supabase migration list

# Capturar estado remoto
supabase db pull

# Aplicar migraciones remotas
supabase db push

# Generar tipos
supabase gen types typescript --local > packages/types/src/database.types.ts

# Frontend
pnpm dev

# Ingestion
cd ingestion
uv run python -m efilicit_ingestion.cli --help
```

### ⚠️ Comando peligroso

No utilizar en producción:

```bash
supabase db reset --linked
```

---

## 17. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Cannot connect to Docker daemon` | Docker no está arrancado | Arrancar Docker |
| Supabase local tarda mucho | Primera descarga de imágenes | Esperar / revisar RAM asignada |
| `supabase start` falla | Docker/memoria/puertos | Revisar `docker info`, memoria y puertos |
| `supabase db pull` falla | Link/credenciales/DB remota | Verificar `supabase link` y acceso |
| La migración capturada no coincide | Drift entre repo y remoto | Revisar `db pull` y `migration list` |
| `db reset` falla | Migración o seed inválidos | Ejecutar desde cero y localizar la migración |
| Local y remoto tienen PostgreSQL major distinta | `config.toml` incorrecto | Alinear `db.major_version` |
| La web no conecta a DB | `.env.local` incorrecto | Revisar URL/key local |
| Auth funciona pero RLS falla | Políticas incorrectas | Revisar RLS en local |
| Storage funciona pero un usuario puede escribir RAW | Policy demasiado permisiva | Corregir política |
| `uv sync` falla | Python incompatible | Verificar Python 3.12.x |
| `pnpm install` falla | Node/pnpm incompatibles | Usar versiones del repo |
| Tipos TS desactualizados | No se regeneraron tras cambio de DB | Ejecutar `supabase gen types` |
| Puerto 3000 ocupado | Otro proceso | Liberarlo/cambiarlo según guía |
| Puerto de Supabase ocupado | Otro proceso/local stack | Revisar `supabase status` / Docker |

---

## 18. Qué NO hacer durante el setup

- **No** crear un segundo proyecto Supabase.
- **No** tocar tablas de producción manualmente.
- **No** ejecutar `supabase db reset --linked` sobre producción.
- **No** copiar datos reales de usuarios a `seed.sql` sin autorización explícita.
- **No** guardar secretos en Git.
- **No** utilizar service role key en React/Next.js cliente.
- **No** instalar dependencias con pip a mano si forman parte del proyecto Python.
- **No** cambiar la versión de Node/pnpm/Python por iniciativa propia.
- **No** modificar `supabase/config.toml` para resolver una incompatibilidad de PostgreSQL sin comprobar primero la versión remota.
- **No** considerar el entorno listo sólo porque `pnpm dev` abre una página.

---

## 19. Qué leer después

- `03-reglas-cursor.md` — reglas que gobiernan cómo Cursor escribe código en este repo.
- `04-roadmap-mvp.md` — plan fase a fase, empezando por la Fase 0.
- `01-arquitectura-fija.md` — decisiones que no deben modificarse sin ADR.
- `docs/sources/` — catálogo y particularidades de las fuentes.

---

## Resumen final

El objetivo de este documento no es simplemente "instalar programas".

El objetivo es conseguir que:

```text
DESARROLLADOR NUEVO
        ↓
MÁQUINA LOCAL REPRODUCIBLE
        ↓
SUPABASE LOCAL
        ↓
MIGRACIONES + SEED
        ↓
AUTH + RLS + STORAGE
        ↓
NEXT.JS
        ↓
PYTHON INGESTION
        ↓
CI
```

funcione **sin tocar producción**.

> **Si la máquina local puede destruirse y reconstruirse desde el repositorio, migraciones, seed y configuración sin intervención manual sobre producción, el setup está bien hecho.**
