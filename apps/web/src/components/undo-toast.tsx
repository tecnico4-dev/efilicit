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

const TOAST_MS = 7000;

type ToastState = {
  message: string;
  /** Si hay callback, se muestra «Revertir». */
  onUndo?: () => void | Promise<void>;
};

type UndoToastApi = {
  showUndo: (message: string, onUndo: () => void | Promise<void>) => void;
  /** Aviso temporal con × (sin Revertir). */
  showStatus: (message: string) => void;
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
    (message: string, onUndo?: () => void | Promise<void>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      undoRef.current = onUndo ?? null;
      setToast({ message, onUndo });
      timerRef.current = setTimeout(clear, TOAST_MS);
    },
    [clear],
  );

  const showUndo = useCallback(
    (msg: string, onUndo: () => void | Promise<void>) => {
      show(msg, onUndo);
    },
    [show],
  );

  const showStatus = useCallback(
    (msg: string) => {
      show(msg);
    },
    [show],
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function onRevert() {
    const fn = undoRef.current;
    clear();
    if (fn) await fn();
  }

  return (
    <UndoToastContext.Provider value={{ showUndo, showStatus }}>
      {children}
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-lg"
          role="status"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={clear}
            className="absolute -right-2.5 -top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground shadow-md hover:bg-muted/90 hover:text-foreground"
          >
            <span aria-hidden className="text-sm leading-none">
              ×
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground">{toast.message}</span>
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
