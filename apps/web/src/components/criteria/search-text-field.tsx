"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { CLEAR_SEARCH_EVENT } from "@/app/search/search-feedback";
import { useOptionalSearchFormPreview } from "@/app/search/search-form-preview";

const MAX_LINES = 5;

function resizeToContent(el: HTMLTextAreaElement) {
  el.style.height = "0px";
  const cs = getComputedStyle(el);
  const lineHeight = Number.parseFloat(cs.lineHeight) || 20;
  const padY =
    Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
  const maxH = lineHeight * MAX_LINES + padY;
  const next = Math.min(el.scrollHeight, maxH);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > maxH + 1 ? "auto" : "hidden";
}

type Props = {
  id: string;
  name?: string;
  defaultValue?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

/**
 * Campo «Texto» multilínea: crece en vertical hasta ~5 líneas; luego scroll.
 * Enter envía el form; Shift+Enter inserta salto de línea.
 */
export function SearchTextField({
  id,
  name = "q",
  defaultValue = "",
  className,
  ...aria
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const preview = useOptionalSearchFormPreview()?.preview ?? null;

  useLayoutEffect(() => {
    if (ref.current) resizeToContent(ref.current);
  }, [defaultValue, preview]);

  useEffect(() => {
    const onClear = () => {
      requestAnimationFrame(() => {
        if (ref.current) resizeToContent(ref.current);
      });
    };
    window.addEventListener(CLEAR_SEARCH_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_SEARCH_EVENT, onClear);
  }, []);

  return (
    <textarea
      ref={ref}
      id={id}
      name={name}
      rows={1}
      defaultValue={defaultValue}
      aria-invalid={aria["aria-invalid"]}
      aria-describedby={aria["aria-describedby"]}
      onInput={(e) => resizeToContent(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
      className={cn(
        className,
        "resize-none overflow-x-hidden break-words whitespace-pre-wrap",
      )}
    />
  );
}
