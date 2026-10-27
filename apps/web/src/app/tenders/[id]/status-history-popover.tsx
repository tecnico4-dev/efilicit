"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatDateMadrid } from "@/lib/datetime";
import { formatTenderStatus } from "@/lib/tender-labels";
import type { StatusTimelineEntry } from "@/lib/tender-status-timeline";

type Props = {
  entries: StatusTimelineEntry[];
};

/**
 * Botón «Histórico registrado»: hover = preview; click = fija el panel
 * hasta click fuera o Escape. Pensado para desktop; en tactil solo click.
 */
export function StatusHistoryPopover({ entries }: Props) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onDocPointerDown(e: MouseEvent | PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-link hover:border-primary/40 hover:bg-primary/10"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.preventDefault();
          if (pinned) {
            setPinned(false);
            setOpen(false);
          } else {
            setPinned(true);
            setOpen(true);
          }
        }}
      >
        Histórico registrado
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Histórico registrado de estado"
          className="absolute top-full right-0 z-30 mt-1 min-w-[14rem] max-w-[20rem] rounded-md border border-border bg-background px-3 py-2 shadow-md"
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Histórico registrado
          </p>
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li
                key={`${entry.at}-${entry.status}`}
                className="grid grid-cols-[6.5rem_1fr] gap-2 text-xs"
              >
                <span className="tabular-nums text-muted-foreground">
                  {formatDateMadrid(entry.at)}
                </span>
                <span className="font-medium text-foreground">
                  {formatTenderStatus(entry.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
