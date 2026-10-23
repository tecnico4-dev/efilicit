"use client";

import { useEffect } from "react";
import { SEARCH_RESULTS_ANCHOR } from "./search-pagination";

/** Tras cambiar de página con `#resultados`, sitúa el scroll al listado. */
export function ScrollToSearchResults() {
  useEffect(() => {
    if (window.location.hash !== `#${SEARCH_RESULTS_ANCHOR}`) return;
    const el = document.getElementById(SEARCH_RESULTS_ANCHOR);
    if (!el) return;
    // Tras el paint del nuevo listado (evitar pelear con el scroll de Next).
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return null;
}
