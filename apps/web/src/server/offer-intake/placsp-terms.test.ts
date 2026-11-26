import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OfferTermsParseError,
  parseOfferTerms,
} from "./placsp-terms";

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../ingestion/tests/fixtures/placsp",
);

function load(name: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, name));
}

describe("parseOfferTerms (TS port)", () => {
  it("maps documents to pliego types and downloadability", () => {
    const extract = parseOfferTerms(load("offer_terms_entry.atom"));
    const byTitle = Object.fromEntries(
      extract.documents.map((d) => [d.title, d]),
    );

    expect(byTitle["PCAP alumbrado.pdf"].pliego_type).toBe("pcap");
    expect(byTitle["Proyecto alumbrado.pdf"].pliego_type).toBe("ppt");
    expect(byTitle["Anexo I DeclaracionResponsable.docx"].pliego_type).toBe(
      "anexo",
    );
    expect(byTitle["Modelo de oferta económica"].pliego_type).toBe("anexo");
    expect(byTitle["Memoria justificativa"].pliego_type).toBe("otro");
    expect(
      byTitle["Pliego de cláusulas administrativas particulares"].pliego_type,
    ).toBe("pcap");
    expect(
      byTitle["Pliego de cláusulas administrativas particulares"].downloadable,
    ).toBe(false);
    expect(byTitle["PCAP alumbrado.pdf"].downloadable).toBe(true);
    expect(byTitle["PCAP alumbrado.pdf"].document_hash).toBe(
      "A6OeDcakZZXPLpktpv84c1uxq6E=",
    );
    expect(byTitle["Memoria justificativa"].downloadable).toBe(false);
    expect(byTitle["Memoria justificativa"].general_type_code).toBe("9");
    expect(new Set(extract.documents.map((d) => d.source_key)).size).toBe(
      extract.documents.length,
    );
  });

  it("reads lots and criteria by scope", () => {
    const extract = parseOfferTerms(load("offer_terms_entry.atom"));
    expect(extract.lots.map((l) => l.lot_id)).toEqual(["1", "2"]);
    expect(extract.lots[0].name).toBe("Lote 1 · Zona norte");
    expect(extract.lots[1].tax_exclusive_amount).toBeCloseTo(148247.93);

    const root = extract.criteria.filter((c) => c.lot_id == null);
    expect(root.map((c) => [c.kind, c.weight])).toEqual([
      ["objetivo", 60],
      ["objetivo", 15],
      ["subjetivo", 25],
    ]);
    expect(root[1].note).toBe("1 punto por año adicional, máximo 15");

    const lotCriteria = extract.criteria.filter((c) => c.lot_id === "1");
    expect(lotCriteria.map((c) => [c.description, c.weight])).toEqual([
      ["Precio lote 1", 70],
    ]);
  });

  it("reads qualifications, guarantees, execution and periods", () => {
    const extract = parseOfferTerms(load("offer_terms_entry.atom"));
    const kinds = extract.qualifications.map((q) => q.kind);
    expect(kinds.filter((k) => k === "solvencia_tecnica")).toHaveLength(1);
    expect(kinds.filter((k) => k === "solvencia_economica")).toHaveLength(1);
    expect(kinds.filter((k) => k === "declaracion")).toHaveLength(2);
    const clas = extract.qualifications.find((q) => q.kind === "clasificacion");
    expect(clas?.description).toBe("Clasificación empresarial: E1-2");
    const eco = extract.qualifications.find(
      (q) => q.kind === "solvencia_economica",
    );
    expect(eco?.threshold).toBeCloseTo(313537.19);

    expect(
      extract.guarantees.map((g) => [g.kind, g.rate_percent]),
    ).toEqual([["definitiva", 5]]);

    expect(
      extract.execution_requirements.map((e) => [e.kind, e.name]),
    ).toEqual([
      ["social", "Consideraciones de tipo social"],
      ["medioambiental", "Consideraciones de tipo medioambiental"],
    ]);

    expect(extract.submission_deadline_at?.toISOString()).toBe(
      "2026-12-09T09:00:00.000Z",
    );
    expect(extract.questions_deadline_at?.toISOString()).toBe(
      "2026-12-05T13:00:00.000Z",
    );
    expect(extract.tender_opening_at?.toISOString()).toBe(
      "2026-12-11T11:00:00.000Z",
    );
    expect(extract.documents_available_until?.toISOString()).toBe(
      "2026-12-07T09:00:00.000Z",
    );
  });

  it("throws on invalid xml / missing status", () => {
    expect(() => parseOfferTerms("not xml")).toThrow(OfferTermsParseError);
    expect(() =>
      parseOfferTerms("<feed xmlns='http://www.w3.org/2005/Atom'/>"),
    ).toThrow(OfferTermsParseError);
  });
});
