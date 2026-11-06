/**
 * Política de contraseña alineada con Supabase Auth:
 * `minimum_password_length = 6` + `lower_upper_letters_digits`.
 */
export const PASSWORD_MIN_LENGTH = 6;

export type PasswordPolicyIssue =
  | "too_short"
  | "no_lower"
  | "no_upper"
  | "no_digit";

const ISSUE_MESSAGES: Record<PasswordPolicyIssue, string> = {
  too_short: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  no_lower: "La contraseña debe incluir al menos una letra minúscula.",
  no_upper: "La contraseña debe incluir al menos una letra mayúscula.",
  no_digit: "La contraseña debe incluir al menos un número.",
};

/** Requisitos en texto (ayuda bajo el campo). */
export const PASSWORD_POLICY_HINT =
  "Mínimo 6 caracteres, con mayúscula, minúscula y número.";

export function validatePasswordPolicy(password: string): PasswordPolicyIssue[] {
  const issues: PasswordPolicyIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push("too_short");
  if (!/[a-z]/.test(password)) issues.push("no_lower");
  if (!/[A-Z]/.test(password)) issues.push("no_upper");
  if (!/[0-9]/.test(password)) issues.push("no_digit");
  return issues;
}

export function passwordPolicyErrorMessage(password: string): string | null {
  const issues = validatePasswordPolicy(password);
  if (issues.length === 0) return null;
  return issues.map((i) => ISSUE_MESSAGES[i]).join(" ");
}

/** Traduce errores típicos de GoTrue/Auth a mensajes de la UI. */
export function mapAuthPasswordError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("at least one character of each") ||
    m.includes("required characters")
  ) {
    return "La contraseña debe incluir mayúscula, minúscula y número.";
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
