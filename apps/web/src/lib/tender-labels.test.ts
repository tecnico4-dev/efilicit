import { describe, expect, it } from "vitest";
import {
  formatContractType,
  formatProcedureType,
  formatSourceCode,
  formatTenderStatus,
} from "./tender-labels";

describe("tender labels", () => {
  it("traduce estados canónicos y legacy", () => {
    expect(formatTenderStatus("publicada")).toBe("Publicada");
    expect(formatTenderStatus("published")).toBe("Publicada");
    expect(formatTenderStatus(null)).toBe("—");
    expect(formatTenderStatus("desconocido")).toBe("desconocido");
  });

  it("traduce tipos de contrato y procedimiento", () => {
    expect(formatContractType("servicios")).toBe("Servicios");
    expect(formatContractType("other")).toBe("Otro");
    expect(formatProcedureType("abierto")).toBe("Abierto");
    expect(formatProcedureType("open")).toBe("Abierto");
  });

  it("traduce source_code", () => {
    expect(formatSourceCode("placsp")).toBe("PlaCSP");
    expect(formatSourceCode("")).toBe("—");
    expect(formatSourceCode("custom_src")).toBe("custom_src");
  });
});
