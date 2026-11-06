/**
 * Política de contraseña alineada con Supabase Auth:
 * `minimum_password_length = 6` + `lower_upper_letters_digits`.
 *
 * Vacío / longitud: los cubre el HTML (`required` + `minLength`) con bocadillos.
 * Luego la UI comprueba coincidencia y, después, mayúscula/minúscula/número.
 */
export const PASSWORD_MIN_LENGTH = 6;

/** Tip de la «i» informativa. */
export const PASSWORD_POLICY_HINT =
  "Mínimo 6 caracteres, con mayúscula, minúscula y número.";

export const PASSWORD_CHARSET_ERROR =
  "La contraseña debe incluir al menos una letra minúscula, una mayúscula y un número.";

export function passwordMeetsCharset(password: string): boolean {
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

/** `null` si cumple mayúscula + minúscula + dígito. */
export function passwordCharsetErrorMessage(password: string): string | null {
  return passwordMeetsCharset(password) ? null : PASSWORD_CHARSET_ERROR;
}

/** Traduce errores típicos de GoTrue/Auth a mensajes de la UI. */
export function mapAuthPasswordError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("at least one character of each") ||
    m.includes("required characters")
  ) {
    return PASSWORD_CHARSET_ERROR;
  }
  if (
    m.includes("at least") &&
    (m.includes("character") || m.includes("characters"))
  ) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (m.includes("weak")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }
  return message;
}
