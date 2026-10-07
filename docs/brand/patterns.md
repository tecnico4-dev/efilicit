# Patrones UI (referencia EfiLumen → EfiLicit)

Resumen de patrones visuales reutilizables. Adaptar a rutas EfiLicit (`/search`, `/alerts`, ficha, etc.); no copiar módulos de alumbrado.

## Shell / layout

- Fondo de página: `var(--background)` (`#f4fbfd`), no blanco puro.
- Cabecera + nav **sticky** arriba; contenido en `<main>` con padding generoso (`p-6`).
- Nav horizontal con borde inferior suave, superficie blanca semitransparente + `backdrop-blur`.
- Ítem activo: fondo `primary` + texto `primary-foreground` + sombra ligera.
- Ítem inactivo: texto `foreground`; hover `muted`.

## Botones

| Variante | Aspecto |
|---|---|
| Primario | `bg-primary`, texto blanco, hover → `primary-dark`; `rounded-lg`, `font-semibold` |
| Outline | borde `border`, fondo `background`/`surface`, hover `muted` |
| Ghost | solo hover `muted` |
| Link | texto `primary`, underline on hover |
| Destructive | tinte rojo suave + texto `destructive` |

Tamaños compactos (altura ~32–36px en UI densa). Focus visible con `ring` = primary.

## Formularios / login

- Card centrada: `max-w-md`, `rounded-2xl`, borde `border`, fondo `surface` con blur, sombra.
- Halo decorativo opcional: radial gradient con primary a baja opacidad detrás del card.
- Labels: texto `muted-foreground`, tamaño `sm`.
- Inputs: borde `border`, fondo `background`, `rounded-lg`, focus `ring-2` con `--ring`.
- Error: caja con borde `destructive` + texto `destructive`.
- CTA full-width primario.

## Tipografía / copy de interfaz

- Títulos de sección: `font-semibold` / `font-bold`, `tracking-tight`.
- Labels de control / chips: a veces `uppercase tracking-wide` + `text-xs` + `muted-foreground`.
- Copy en español, directo (“Iniciar sesión”, “Entrar”, “Accede con tus credenciales”).
- Evitar textos de demo/placeholder de Semana 5 al rediseñar.

## Formas y detalle

- Radio base: `--radius: 0.625rem` (~10px); cards grandes hasta `rounded-2xl`.
- Chips / selects compactos: a menudo `rounded-full`.
- Bordes siempre en la familia azulada (`--border`), no gris neutro genérico.
- Iconos: Lucide en EfiLumen (opcional en EfiLicit).

## Tema

- EfiLumen soporta claro/oscuro (`next-themes`).
- Recomendación EfiLicit Semana 6: **modo claro corporativo primero**; dark como mejora si sobra tiempo.
