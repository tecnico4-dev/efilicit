/**
 * Mis licitaciones (offer_*): gate por env.
 * Productivo: activado en Vercel (`NEXT_PUBLIC_MIS_LICITACIONES_ENABLED=1`).
 * Local: mismo flag en `apps/web/.env.local`. Sin flag → nav oculta + middleware a `/`.
 */
export function isMisLicitacionesEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_MIS_LICITACIONES_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
