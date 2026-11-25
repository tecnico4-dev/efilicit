import { describe, expect, it } from "vitest";
import {
  mapAuthLoginError,
  mapAuthPasswordError,
  PASSWORD_CHARSET_ERROR,
  passwordCharsetErrorMessage,
  passwordMeetsCharset,
} from "./password-policy";

describe("passwordMeetsCharset", () => {
  it("exige minúscula, mayúscula y número", () => {
    expect(passwordMeetsCharset("Abcdef1")).toBe(true);
    expect(passwordMeetsCharset("abcdef1")).toBe(false);
    expect(passwordMeetsCharset("ABCDEF1")).toBe(false);
    expect(passwordMeetsCharset("Abcdef")).toBe(false);
  });
});

describe("passwordCharsetErrorMessage", () => {
  it("devuelve null o el mensaje fijo", () => {
    expect(passwordCharsetErrorMessage("Abcdef1")).toBeNull();
    expect(passwordCharsetErrorMessage("abc")).toBe(PASSWORD_CHARSET_ERROR);
  });
});

describe("mapAuthPasswordError", () => {
  it("traduce errores típicos de Auth", () => {
    expect(
      mapAuthPasswordError("Password should contain at least one character of each"),
    ).toBe(PASSWORD_CHARSET_ERROR);
    expect(
      mapAuthPasswordError("Password should be at least 6 characters"),
    ).toContain("6 caracteres");
    expect(mapAuthPasswordError("Password is too weak")).toContain(
      "requisitos de seguridad",
    );
    expect(mapAuthPasswordError("otro error")).toBe("otro error");
  });
});

describe("mapAuthLoginError", () => {
  it("traduce credenciales inválidas y otros errores de login", () => {
    expect(mapAuthLoginError("Invalid login credentials")).toBe(
      "Usuario o contraseña incorrectos.",
    );
    expect(mapAuthLoginError("Email not confirmed")).toContain("Confirma tu correo");
    expect(mapAuthLoginError("Too many requests")).toContain("Demasiados intentos");
    expect(mapAuthLoginError("something else")).toBe(
      "No se pudo iniciar sesión. Inténtalo de nuevo.",
    );
  });
});
