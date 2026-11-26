/**
 * Mis licitaciones (offer_*): solo desarrollo local hasta MVP aceptable.
 * Remoto (preview/prod): desactivado por defecto — nav oculta + middleware redirige.
 *
 * Local: NEXT_PUBLIC_MIS_LICITACIONES_ENABLED=1 en apps/web/.env.local
 * Nunca activar en Vercel hasta OK explícito del equipo.
 */
export function isMisLicitacionesEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_MIS_LICITACIONES_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
