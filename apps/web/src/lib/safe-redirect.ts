/**
 * Solo rutas relativas internas para post-login (anti open-redirect).
 * Rechaza `//host`, esquemas, backslashes y control chars.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (raw == null) return fallback;
  const path = raw.trim();
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.includes("\\") || path.includes("%5c") || path.includes("%5C")) {
    return fallback;
  }
  if (/[\0\r\n]/.test(path)) return fallback;
  // /javascript:... u otros esquemas embebidos
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(path)) return fallback;
  return path;
}
