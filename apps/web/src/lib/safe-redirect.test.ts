import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("acepta rutas internas relativas", () => {
    expect(safeRedirectPath("/search")).toBe("/search");
    expect(safeRedirectPath("/favorites/tenders?x=1")).toBe(
      "/favorites/tenders?x=1",
    );
  });

  it("usa fallback si viene vacío o null", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("   ")).toBe("/");
    expect(safeRedirectPath("", "/account")).toBe("/account");
  });

  it("rechaza open-redirect y esquemas", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil")).toBe("/");
    expect(safeRedirectPath("/%5cevil")).toBe("/");
    expect(safeRedirectPath("/javascript:alert(1)")).toBe("/");
    expect(safeRedirectPath("search")).toBe("/");
  });
});
