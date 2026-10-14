"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      {crossed ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.6 11.6 0 0 1-4 5.1" />
          <path d="M6.1 6.1A11.6 11.6 0 0 0 1 12.5C2.7 16.9 7 20 12 20a9.8 9.8 0 0 0 4.2-.9" />
        </>
      ) : (
        <>
          <path d="M2 12.5C3.7 8.1 7.9 5 12 5s8.3 3.1 10 7.5c-1.7 4.4-5.9 7.5-10 7.5S3.7 16.9 2 12.5z" />
          <circle cx="12" cy="12.5" r="2.5" />
        </>
      )}
    </svg>
  );
}

/** Input de contraseña con botón mostrar/ocultar. */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={show}
        tabIndex={-1}
      >
        <EyeIcon crossed={!show} />
      </button>
    </div>
  );
}
