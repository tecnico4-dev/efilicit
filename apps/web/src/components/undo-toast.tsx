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

type UndoToastApi = {
  showUndo: (message: string, onUndo: () => void | Promise<void>) => void;
};

const UndoToastContext = createContext<UndoToastApi | null>(null);

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const undoRef = useRef<(() => void | Promise<void>) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setMessage(null);
    undoRef.current = null;
  }, []);

  const showUndo = useCallback(
    (msg: string, onUndo: () => void | Promise<void>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      undoRef.current = onUndo;
      setMessage(msg);
      timerRef.current = setTimeout(clear, TOAST_MS);
    },
    [clear],
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
    <UndoToastContext.Provider value={{ showUndo }}>
      {children}
      {message ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-surface px-4 py-3 pr-10 text-sm text-foreground shadow-lg"
          role="status"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={clear}
            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span aria-hidden className="text-base leading-none">
              ×
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground">{message}</span>
            <button
              type="button"
              className="font-medium text-link hover:underline"
              onClick={onRevert}
            >
              Revertir
            </button>
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
