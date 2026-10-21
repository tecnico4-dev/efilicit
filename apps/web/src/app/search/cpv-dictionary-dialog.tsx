"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  formatCpvSelection,
  listCpvChildren,
  listCpvRoots,
  lookupCpvLabel,
} from "@/lib/cpv";

type CpvDictionaryDialogProps = {
  open: boolean;
  /** Selección actual del picker (se copia al abrir). */
  selectedCodes: string[];
  onSave: (codes: string[]) => void;
  onCancel: () => void;
};

/**
 * Modal a pantalla bloqueada: árbol CPV (izq.) + selección provisional (der.).
 * Guardar aplica; Cancelar descarta.
 */
export function CpvDictionaryDialog({
  open,
  selectedCodes,
  onSave,
  onCancel,
}: CpvDictionaryDialogProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraft([...selectedCodes]);
    setExpanded(new Set());
  }, [open, selectedCodes]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const roots = useMemo(() => listCpvRoots(), []);
  const draftSet = useMemo(() => new Set(draft), [draft]);

  function toggleExpand(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleSelect(code: string) {
    setDraft((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92vh,40rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
      >
        <header className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <h2
            id={titleId}
            className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
          >
            Diccionario CPV
          </h2>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <section
            className="flex min-h-0 flex-col"
            aria-label="Árbol de códigos CPV"
          >
            <p className="shrink-0 px-4 py-2 text-xs font-medium text-muted-foreground">
              Catálogo
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 text-sm">
              {roots.map((code) => (
                <CpvTreeNode
                  key={code}
                  code={code}
                  depth={0}
                  expanded={expanded}
                  selected={draftSet}
                  onToggleExpand={toggleExpand}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </ul>
          </section>

          <section
            className="flex min-h-0 flex-col"
            aria-label="CPV seleccionados en el diálogo"
          >
            <p className="shrink-0 px-4 py-2 text-xs font-medium text-muted-foreground">
              Seleccionados ({draft.length})
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
              {draft.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ninguno. Marca códigos en el catálogo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {draft.map((code) => (
                    <li
                      key={code}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 break-words font-mono text-xs text-foreground sm:text-sm">
                        {formatCpvSelection(code)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSelect(code)}
                        className="shrink-0 text-xs text-muted-foreground hover:text-destructive hover:underline"
                        aria-label={`Quitar CPV ${code}`}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={() => onSave(draft)}>
            Guardar cambios
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function CpvTreeNode({
  code,
  depth,
  expanded,
  selected,
  onToggleExpand,
  onToggleSelect,
}: {
  code: string;
  depth: number;
  expanded: Set<string>;
  selected: Set<string>;
  onToggleExpand: (code: string) => void;
  onToggleSelect: (code: string) => void;
}) {
  const children = listCpvChildren(code);
  const hasChildren = children.length > 0;
  const isOpen = expanded.has(code);
  const label = lookupCpvLabel(code) ?? code;
  const checked = selected.has(code);

  return (
    <li>
      <div
        className="flex items-start gap-1 rounded-md py-0.5 pr-1 hover:bg-muted/60"
        style={{ paddingLeft: `${0.25 + depth * 0.75}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(code)}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-expanded={isOpen}
            aria-label={isOpen ? `Contraer ${code}` : `Expandir ${code}`}
          >
            <span className="text-[0.65rem] leading-none" aria-hidden>
              {isOpen ? "▼" : "▶"}
            </span>
          </button>
        ) : (
          <span className="mt-0.5 inline-block h-5 w-5 shrink-0" aria-hidden />
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 py-0.5">
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={checked}
            onChange={() => onToggleSelect(code)}
          />
          <span className="min-w-0">
            <span className="font-mono text-xs text-foreground">{code}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {label}
            </span>
          </span>
        </label>
      </div>
      {hasChildren && isOpen ? (
        <ul>
          {children.map((child) => (
            <CpvTreeNode
              key={child}
              code={child}
              depth={depth + 1}
              expanded={expanded}
              selected={selected}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
