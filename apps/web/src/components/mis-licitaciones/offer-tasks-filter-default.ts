/** Vista por defecto del filtro de Tareas (localStorage; solo cliente). */

export const OFFER_TASKS_DEFAULT_FILTER_KEY =
  "efilicit.offerTasks.defaultFilterPreset";

export type TaskDefaultFilterPreset =
  | "todas"
  | "pendientes"
  | "mis_pendientes";

function storageKey(userId: string): string {
  return `${OFFER_TASKS_DEFAULT_FILTER_KEY}.${userId}`;
}

export function fallbackTaskDefaultPreset(
  viewerMemberId: string | null,
): TaskDefaultFilterPreset {
  return viewerMemberId ? "mis_pendientes" : "pendientes";
}

export function resolveTaskDefaultPreset(
  raw: string | null,
  viewerMemberId: string | null,
): TaskDefaultFilterPreset {
  if (raw === "todas" || raw === "pendientes" || raw === "mis_pendientes") {
    if (raw === "mis_pendientes" && !viewerMemberId) return "pendientes";
    return raw;
  }
  return fallbackTaskDefaultPreset(viewerMemberId);
}

export function readTaskDefaultFilterPreset(
  userId: string,
  viewerMemberId: string | null,
): TaskDefaultFilterPreset {
  if (typeof window === "undefined") {
    return fallbackTaskDefaultPreset(viewerMemberId);
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return resolveTaskDefaultPreset(raw, viewerMemberId);
  } catch {
    return fallbackTaskDefaultPreset(viewerMemberId);
  }
}

export function writeTaskDefaultFilterPreset(
  userId: string,
  preset: TaskDefaultFilterPreset,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), preset);
  } catch {
    /* ignore */
  }
}
