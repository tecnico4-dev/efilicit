"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "requisitos", label: "Requisitos" },
  { id: "sobres", label: "Sobres" },
  { id: "pliegos", label: "Pliegos y fuentes" },
  { id: "equipo", label: "Equipo" },
  { id: "calendario", label: "Calendario" },
  { id: "bitacora", label: "Bitácora" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));
const TAB_STORAGE_KEY = "efilicit:mis-licitaciones-detail-tab";

function isTabId(value: string | null): value is TabId {
  return value != null && TAB_IDS.has(value);
}

export type DetailTabLeaveGuard = (nextTab: TabId) => boolean | Promise<boolean>;

type GuardCtx = {
  setLeaveGuard: (guard: DetailTabLeaveGuard | null) => void;
};

const DetailTabsGuardContext = createContext<GuardCtx | null>(null);

/**
 * Registra un guardia al cambiar de pestaña (p. ej. editar requisitos sin guardar).
 * `enabled` false limpia el guardia.
 */
export function useDetailTabsLeaveGuard(
  enabled: boolean,
  guard: DetailTabLeaveGuard,
) {
  const ctx = useContext(DetailTabsGuardContext);
  const guardRef = useRef(guard);
  guardRef.current = guard;

  useEffect(() => {
    if (!ctx) return;
    if (!enabled) {
      ctx.setLeaveGuard(null);
      return;
    }
    ctx.setLeaveGuard((next) => guardRef.current(next));
    return () => ctx.setLeaveGuard(null);
  }, [ctx, enabled]);
}

export function DetailTabs({
  panes,
}: {
  panes: Record<TabId, ReactNode>;
}) {
  const [tab, setTab] = useState<TabId>("resumen");
  const leaveGuardRef = useRef<DetailTabLeaveGuard | null>(null);

  const setLeaveGuard = useCallback((guard: DetailTabLeaveGuard | null) => {
    leaveGuardRef.current = guard;
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (isTabId(saved)) setTab(saved);
  }, []);

  async function selectTab(next: TabId) {
    if (next === tab) return;
    const guard = leaveGuardRef.current;
    if (guard) {
      const ok = await guard(next);
      if (!ok) return;
    }
    setTab(next);
    sessionStorage.setItem(TAB_STORAGE_KEY, next);
  }

  return (
    <DetailTabsGuardContext.Provider value={{ setLeaveGuard }}>
      <div>
        <div className="flex flex-wrap gap-1 border-b border-border pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void selectTab(t.id)}
              className={cn(
                "rounded-t-md px-3 py-1.5 text-sm transition-colors",
                tab === t.id
                  ? "border-b-2 border-primary font-semibold text-primary-dark"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-4">{panes[tab]}</div>
      </div>
    </DetailTabsGuardContext.Provider>
  );
}
