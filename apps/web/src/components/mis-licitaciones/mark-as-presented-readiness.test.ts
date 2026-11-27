import { describe, expect, it } from "vitest";
import {
  assessPresentationReadiness,
  presentationReadinessLines,
} from "./mark-as-presented-readiness";

describe("assessPresentationReadiness", () => {
  it("is ready when compliance ok, prep listo and tasks closed", () => {
    const r = assessPresentationReadiness(
      [
        { compliance_status: "cumple", prep_status: "listo" },
        { compliance_status: "no_aplica", prep_status: "pendiente" },
      ],
      [
        { status: "hecha" },
        { status: "descartada" },
      ],
    );
    expect(r.ready).toBe(true);
    expect(presentationReadinessLines(r)).toEqual([]);
  });

  it("flags compliance, prep and open tasks", () => {
    const r = assessPresentationReadiness(
      [
        { compliance_status: "sin_verificar", prep_status: "pendiente" },
        { compliance_status: "parcial", prep_status: "en_curso" },
        { compliance_status: "no_cumple", prep_status: "listo" },
      ],
      [{ status: "pendiente" }],
    );
    expect(r.ready).toBe(false);
    expect(r.compliancePending).toBe(2);
    expect(r.prepPending).toBe(1);
    expect(r.tasksOpen).toBe(1);
    expect(presentationReadinessLines(r)).toEqual([
      "Quedan 3 requisitos sin cumplimiento válido.",
      "Queda 1 tarea pendiente.",
    ]);
  });
});
