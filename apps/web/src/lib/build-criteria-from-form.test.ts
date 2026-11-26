/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import {
  buildCriteriaFromSearchForm,
  ensureEnPlazoParam,
  hasAnyCriterion,
  hasInvalidAmountRange,
  hasInvalidPublicationRange,
} from "./build-criteria-from-form";

function makeForm(html: string): HTMLFormElement {
  document.body.innerHTML = `<form id="f">${html}</form>`;
  return document.getElementById("f") as HTMLFormElement;
}

describe("buildCriteriaFromSearchForm", () => {
  it("devuelve null si solo hay en_plazo", () => {
    const form = makeForm(
      `<input name="en_plazo" type="checkbox" value="1" checked />`,
    );
    expect(buildCriteriaFromSearchForm(form)).toBeNull();
    expect(hasAnyCriterion(form)).toBe(false);
  });

  it("construye criteria con keywords, CPV all e importe", () => {
    const form = makeForm(`
      <input name="q" value="limpieza de colegios" />
      <input name="cpv" value="90910000" />
      <input name="cpv" value="90911000" />
      <input name="cpv_match" value="all" />
      <input name="min" value="1000" />
      <input name="max" value="5000" />
      <input name="en_plazo" type="checkbox" value="1" checked />
    `);
    const criteria = buildCriteriaFromSearchForm(form);
    expect(criteria).toMatchObject({
      version: 1,
      keywords: ["limpieza", "colegios"],
      cpv_codes: ["90910000", "90911000"],
      cpv_match: "all",
      estimated_value_min: 1000,
      estimated_value_max: 5000,
      open_for_submission: true,
    });
    expect(hasAnyCriterion(form)).toBe(true);
  });

  it("detecta rangos inválidos", () => {
    const form = makeForm(`
      <input name="pub_from" value="2026-06-01" />
      <input name="pub_to" value="2026-01-01" />
      <input name="min" value="9000" />
      <input name="max" value="1000" />
    `);
    expect(hasInvalidPublicationRange(form)).toBe(true);
    expect(hasInvalidAmountRange(form)).toBe(true);
  });

  it("inyecta en_plazo=0 si el checkbox está desmarcado", () => {
    const form = makeForm(
      `<input name="en_plazo" type="checkbox" value="1" />`,
    );
    ensureEnPlazoParam(form);
    const hidden = form.querySelector(
      'input[data-en-plazo-off="1"]',
    ) as HTMLInputElement;
    expect(hidden).toBeTruthy();
    expect(hidden.value).toBe("0");
  });
});
