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
  { id: "tareas", label: "Tareas" },
  { id: "calendario", label: "Calendario" },
  { id: "bitacora", label: "Bitácora" },
] as const;

export type DetailTabId = (typeof TABS)[number]["id"];
type TabId = DetailTabId;

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

export const DETAIL_TAB_NAV_EVENT = "efilicit:detail-tab-nav";

export type DetailTabNavDetail = {
  tab: TabId;
  /** p. ej. data-offer-requirement-id */
  scrollAttr?: string;
  scrollId?: string;
};

/** Navegación a pestaña desde fuera del árbol de tabs (p. ej. «Qué falta»). */
export function navigateDetailTab(detail: DetailTabNavDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DetailTabNavDetail>(DETAIL_TAB_NAV_EVENT, { detail }),
  );
}

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
  /** `null` = pestaña oculta en el mininav (p. ej. Calendario sin plazos). */
  panes: Record<TabId, ReactNode | null>;
}) {
  const visibleTabs = TABS.filter((t) => panes[t.id] != null);
  const [tab, setTab] = useState<TabId>("resumen");
  const leaveGuardRef = useRef<DetailTabLeaveGuard | null>(null);

  const setLeaveGuard = useCallback((guard: DetailTabLeaveGuard | null) => {
    leaveGuardRef.current = guard;
  }, []);

  const tabAvailable = panes[tab] != null;

  useEffect(() => {
    const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (isTabId(saved) && panes[saved] != null) {
      setTab(saved);
    }
    // panes del RSC ya están en el primer render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tabAvailable) setTab("resumen");
  }, [tabAvailable]);

  const selectTab = useCallback(
    async (next: TabId) => {
      if (panes[next] == null) return;
      if (next !== tab) {
        const guard = leaveGuardRef.current;
        if (guard) {
          const ok = await guard(next);
          if (!ok) return;
        }
        setTab(next);
        sessionStorage.setItem(TAB_STORAGE_KEY, next);
      }
    },
    [tab, panes],
  );

  useEffect(() => {
    function onNav(e: Event) {
      const ce = e as CustomEvent<DetailTabNavDetail>;
      const detail = ce.detail;
      if (!detail?.tab || !isTabId(detail.tab)) return;
      void (async () => {
        await selectTab(detail.tab);
        if (!detail.scrollAttr || !detail.scrollId) return;
        window.setTimeout(() => {
          const el = document.querySelector(
            `[${detail.scrollAttr}="${CSS.escape(detail.scrollId!)}"]`,
          );
          if (!(el instanceof HTMLElement)) return;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "ring-offset-2");
          window.setTimeout(() => {
            el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
          }, 1600);
        }, 80);
      })();
    }
    window.addEventListener(DETAIL_TAB_NAV_EVENT, onNav);
    return () => window.removeEventListener(DETAIL_TAB_NAV_EVENT, onNav);
  }, [selectTab]);

  const activeTab: TabId = tabAvailable ? tab : "resumen";

  return (
    <DetailTabsGuardContext.Provider value={{ setLeaveGuard }}>
      <div>
        <div className="flex flex-wrap gap-1 border-b border-border pb-1">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void selectTab(t.id)}
              className={cn(
                "rounded-t-md px-3 py-1.5 text-sm transition-colors",
                activeTab === t.id
                  ? "border-b-2 border-primary font-semibold text-primary-dark"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-4">{panes[activeTab]}</div>
      </div>
    </DetailTabsGuardContext.Provider>
  );
}
