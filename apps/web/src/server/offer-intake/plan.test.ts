import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseOfferTerms } from "./placsp-terms";
import { buildIntakePlan, formatNumber } from "./plan";

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../ingestion/tests/fixtures/placsp/offer_terms_entry.atom",
);

function plan(targetLots: string[] = []) {
  return buildIntakePlan(
    parseOfferTerms(fs.readFileSync(FIXTURE)),
    targetLots,
  );
}

describe("buildIntakePlan (TS port)", () => {
  it("sets fetch status from downloadability", () => {
    const p = plan();
    const statuses = Object.fromEntries(
      p.pliegos.map((row) => [row.title, row.initial_fetch_status]),
    );
    expect(statuses["PCAP alumbrado.pdf"]).toBe("pendiente");
    expect(statuses["Memoria justificativa"]).toBe("solo_enlace");
  });

  it("maps requirements categories and values", () => {
    const p = plan();
    const eco = p.requirements.find((r) => r.category === "solvencia_economica");
    expect(eco?.envelope).toBe("A");
    expect(eco?.required_value).toBe("Umbral: 313.537,19");
    expect(eco?.title.startsWith("Solvencia económica: ")).toBe(true);

    const guarantee = p.requirements.find((r) => r.category === "garantias");
    expect(guarantee?.title).toBe("Garantía definitiva");
    expect(guarantee?.required_value).toBe("5 %");

    const executions = p.requirements.filter(
      (r) => r.category === "condiciones_ejecucion",
    );
    expect(executions).toHaveLength(2);
    expect(p.requirements.some((r) => r.category === "criterio_adjudicacion")).toBe(
      false,
    );
  });

  it("groups deliverables by envelope", () => {
    const p = plan();
    const byKey = Object.fromEntries(p.deliverables.map((d) => [d.source_key, d]));
    expect(
      p.deliverables.filter((d) => !d.parent_key).map((d) => d.source_key),
    ).toEqual(["env:A", "env:B", "env:C"]);
    expect(byKey["env:B"].points_max).toBe(25);
    expect(byKey["env:C"].points_max).toBe(75);
    expect(byKey["env:A"].points_max).toBeNull();
  });

  it("formats numbers es-ES", () => {
    expect(formatNumber(313537.19)).toBe("313.537,19");
    expect(formatNumber(60)).toBe("60");
  });
});
