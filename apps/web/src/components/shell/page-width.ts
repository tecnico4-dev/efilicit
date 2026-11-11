/**
 * Ancho de contenido de producto.
 * Móvil: fluido con padding; escritorio: más ancho que el antiguo max-w-3xl
 * para reducir huecos laterales (alineado con la cabecera).
 */
export const PAGE_MAIN_CLASS =
  "mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10";

export const PAGE_MAIN_NARROW_CLASS =
  "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10";

/**
 * Contenido casi a ancho de ventana (p. ej. Favoritos con 3 paneles).
 * La nav sigue en max-w-6xl; solo afecta al `<main>` de la página.
 */
export const PAGE_MAIN_WIDE_CLASS =
  "flex w-full flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10";

/**
 * Punto medio entre el estándar (max-w-6xl ≈ 72rem) y el ancho completo.
 * ~90rem ≈ 1440px; centrado con el mismo padding.
 */
export const PAGE_MAIN_MEDIUM_CLASS =
  "mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10";

/** Separador bajo el H1 de página (mismo patrón que Alertas / AlertsPanel). */
export const PAGE_TITLE_RULE = "mt-8 border-t border-border pt-8";
