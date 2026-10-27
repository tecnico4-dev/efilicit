/**
 * Carga diferida del diccionario CPV (dynamic import).
 * Llamar `preloadCpvDictionary()` al montar el buscador (idle) para tenerlo
 * listo al teclear o abrir la «i», sin meter el JSON en el camino crítico.
 */
import type * as CpvDictionaryModule from "@/lib/cpv-dictionary";

type CpvDict = typeof CpvDictionaryModule;

let loadPromise: Promise<CpvDict> | null = null;

export function preloadCpvDictionary(): Promise<CpvDict> {
  if (!loadPromise) {
    loadPromise = import("@/lib/cpv-dictionary");
  }
  return loadPromise;
}
