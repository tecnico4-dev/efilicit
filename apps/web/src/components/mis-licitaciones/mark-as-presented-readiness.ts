/**
 * Comprobaciones antes de marcar un expediente como presentada.
 * - Cumplimiento: todos en cumple | parcial | no_aplica
 * - Prep: los cumple/parcial deben estar en listo
 * - Tareas: todas hecha o descartada (ninguna pendiente)
 */

export type PresentationReqInput = {
  compliance_status: string;
  prep_status: string;
};

export type PresentationTaskInput = {
  status: string;
};

export type PresentationReadiness = {
  ready: boolean;
  compliancePending: number;
  prepPending: number;
  tasksOpen: number;
};

const COMPLIANCE_OK = new Set(["cumple", "parcial", "no_aplica"]);

export function assessPresentationReadiness(
  requirements: PresentationReqInput[],
  tasks: PresentationTaskInput[],
): PresentationReadiness {
  let compliancePending = 0;
  let prepPending = 0;
  for (const r of requirements) {
    if (!COMPLIANCE_OK.has(r.compliance_status)) {
      compliancePending += 1;
      continue;
    }
    if (
      (r.compliance_status === "cumple" || r.compliance_status === "parcial") &&
      r.prep_status !== "listo"
    ) {
      prepPending += 1;
    }
  }

  const tasksOpen = tasks.filter((t) => t.status === "pendiente").length;

  return {
    ready: compliancePending === 0 && prepPending === 0 && tasksOpen === 0,
    compliancePending,
    prepPending,
    tasksOpen,
  };
}

export function presentationReadinessLines(
  readiness: PresentationReadiness,
): string[] {
  const lines: string[] = [];
  const reqsPending = readiness.compliancePending + readiness.prepPending;
  if (reqsPending > 0) {
    lines.push(
      reqsPending === 1
        ? "Queda 1 requisito sin cumplimiento válido."
        : `Quedan ${reqsPending} requisitos sin cumplimiento válido.`,
    );
  }
  if (readiness.tasksOpen > 0) {
    const n = readiness.tasksOpen;
    lines.push(
      n === 1 ? "Queda 1 tarea pendiente." : `Quedan ${n} tareas pendientes.`,
    );
  }
  return lines;
}
