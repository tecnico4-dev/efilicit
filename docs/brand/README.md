# Brand EfiLicit (kit visual corporativo)

Fuente de referencia: web local **EfiLumen** (`efilumen-web`), alineada a colores corporativos Eficen (comentarios en su `globals.css` → APK `Color.kt`).

**Uso en EfiLicit:** guía + tokens para `apps/web` (Semana 6 Paso 1+). No es una copia de la app EfiLumen.

| Archivo | Qué contiene |
|---|---|
| [tokens.css](tokens.css) | Variables CSS corporativas (claro + oscuro) |
| [patterns.md](patterns.md) | Nav, botones, formularios, shell |
| Este README | Resumen, tipografía, assets, decisiones |

---

## Identidad en una frase

Fondo claro con tinte azul-cielo suave, acento **cian corporativo** (`#52b9d8`), tipografía **Geist**, radios redondeados moderados, superficies blancas con bordes azulados suaves. Sensación limpia / técnica / “plataforma interna”, no marketing agresivo.

## Colores clave (modo claro — fuente de verdad)

| Rol | Hex | Notas |
|---|---|---|
| Primary | `#52b9d8` | Acciones, nav activo, ring |
| Primary dark | `#3a9bbf` | Hover de primary / enlaces |
| Primary light | `#b3e3f0` | Destacados suaves |
| Background | `#f4fbfd` | Página (no blanco puro) |
| Surface / card | `#ffffff` | Paneles, login card |
| Foreground | `#212121` | Texto principal |
| Muted fg | `#757575` | Texto secundario |
| Border / input | `#d6eaf1` | Bordes |
| Muted bg | `#eaf6fa` | Zebra / hover suave |
| Destructive | `#d32f2f` | Errores |

Modo oscuro en EfiLumen usa azules más “genéricos” (`#3b82f6`, fondo `#0b1226`). Para EfiLicit MVP se puede empezar **solo claro** (como Semana 5) y aplicar dark después si hace falta.

## Tipografía

- **Sans:** Geist (`next/font/google` → `--font-geist-sans`)
- **Mono:** Geist Mono (`--font-geist-mono`)
- Fallback: Arial / Helvetica / system-ui
- Idioma UI de referencia: **español**

EfiLicit ya carga Geist en el layout; reutilizar.

## Logos / assets

En `efilumen-web/public` **no** hay logo corporativo Eficen/EfiLumen (solo SVGs plantilla Next/Vercel).  
**Pendiente:** aportar logo oficial (SVG/PNG) a `apps/web/public/` o `docs/brand/assets/` cuando exista. Hasta entonces: nombre de producto en tipografía + color primary.

## Qué NO reutilizar

- Paletas de mapa (viridis, cumplimiento, circuitos eléctricos): son dominio alumbrado, no brand de producto.
- Copy/módulos de inventario/mapa/telegestión: otro producto.
- Código React completo de EfiLumen: solo patrones y tokens.

## Dónde aplicar tokens en EfiLicit (Paso 1)

1. Copiar/adaptar variables de [tokens.css](tokens.css) a `apps/web/src/app/globals.css`.
2. Mapear en `@theme inline` (Tailwind v4) como en EfiLumen.
3. Shell (nav/header) + botones/inputs con `var(--primary)`, etc.
4. No hardcodear `slate-*` / colores sueltos si ya hay token.

## Origen

Extraído en Semana 6 Paso 0 desde lectura local de `efilumen-web` (sin modificar ese repo).
