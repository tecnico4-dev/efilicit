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

const TOAST_MS = 7000;
const TOAST_WARNING_MS = 9000;

type ToastTone = "default" | "warning";

type ToastState = {
  message: string;
  tone: ToastTone;
  /** Si hay callback, se muestra «Revertir». */
  onUndo?: () => void | Promise<void>;
};

type UndoToastApi = {
  showUndo: (message: string, onUndo: () => void | Promise<void>) => void;
  /** Aviso temporal con × (sin Revertir). */
  showStatus: (message: string) => void;
  /** Aviso destacado (borde/texto alerta); p. ej. búsqueda acotada a top-K. */
  showWarning: (message: string) => void;
};

const UndoToastContext = createContext<UndoToastApi | null>(null);

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const undoRef = useRef<(() => void | Promise<void>) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
    undoRef.current = null;
  }, []);

  const show = useCallback(
    (
      message: string,
      opts?: { onUndo?: () => void | Promise<void>; tone?: ToastTone },
    ) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const tone = opts?.tone ?? "default";
      undoRef.current = opts?.onUndo ?? null;
      setToast({ message, tone, onUndo: opts?.onUndo });
      timerRef.current = setTimeout(
        clear,
        tone === "warning" ? TOAST_WARNING_MS : TOAST_MS,
      );
    },
    [clear],
  );

  const showUndo = useCallback(
    (msg: string, onUndo: () => void | Promise<void>) => {
      show(msg, { onUndo });
    },
    [show],
  );

  const showStatus = useCallback(
    (msg: string) => {
      show(msg);
    },
    [show],
  );

  const showWarning = useCallback(
    (msg: string) => {
      show(msg, { tone: "warning" });
    },
    [show],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function onRevert() {
    const fn = undoRef.current;
    clear();
    if (fn) await fn();
  }

  const isWarning = toast?.tone === "warning";

  return (
    <UndoToastContext.Provider value={{ showUndo, showStatus, showWarning }}>
      {children}
      {toast ? (
        <div
          className={cn(
            "fixed left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-3 text-sm shadow-lg",
            isWarning
              ? "top-[4.75rem] w-[min(28rem,calc(100vw-2rem))] border border-destructive/50 bg-[color-mix(in_srgb,var(--destructive)_18%,var(--surface))]"
              : "bottom-10 w-[min(24rem,calc(100vw-2rem))] border border-border bg-surface",
          )}
          role="status"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={clear}
            className={cn(
              "absolute -right-2.5 -top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-md",
              isWarning
                ? "border-destructive/40 bg-surface text-destructive hover:bg-destructive/10"
                : "border-border bg-muted text-muted-foreground hover:bg-muted/90 hover:text-foreground",
            )}
          >
            <span aria-hidden className="text-sm leading-none">
              ×
            </span>
          </button>
          <div
            className={cn(
              "flex flex-wrap items-center gap-3",
              isWarning && "justify-center",
            )}
          >
            <span
              className={cn(
                isWarning
                  ? "whitespace-pre-line text-center font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {toast.message}
            </span>
            {toast.onUndo ? (
              <button
                type="button"
                className="font-medium text-link hover:underline"
                onClick={onRevert}
              >
                Revertir
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </UndoToastContext.Provider>
  );
}

export function useUndoToast(): UndoToastApi {
  const ctx = useContext(UndoToastContext);
  if (!ctx) {
    throw new Error("useUndoToast requiere UndoToastProvider");
  }
  return ctx;
}
