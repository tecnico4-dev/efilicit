/** Une clases CSS omitiendo falsy (sin dependencia extra). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
