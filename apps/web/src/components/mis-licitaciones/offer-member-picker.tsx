"use client";

import { useRef, useState } from "react";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { cn } from "@/lib/cn";
import type { EficenMemberForTeam } from "@/lib/queries";

function shortMemberName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const lastInitial = parts[1]!.charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={cn("size-3.5 shrink-0", className)}
    >
      <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path
        fillRule="evenodd"
        d="M10 11c-3.3 0-6 1.8-6 4v.5c0 .3.2.5.5.5h11c.3 0 .5-.2.5-.5V15c0-2.2-2.7-4-6-4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MemberAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn("size-4 shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full",
        "bg-muted text-[0.55rem] font-semibold leading-none text-foreground",
        className,
      )}
      aria-hidden
    >
      {memberInitials(name)}
    </span>
  );
}

/**
 * Picker de `eficen_members` (mismo patrón que responsable en Requisitos).
 * `boxed` = campo de formulario con borde (modales).
 */
export function OfferMemberPicker({
  value,
  members,
  disabled,
  boxed,
  emptyLabel = "Sin asignar",
  ariaLabel = "Asignada a",
  onChange,
}: {
  value: string | null;
  members: EficenMemberForTeam[];
  disabled?: boolean;
  boxed?: boolean;
  emptyLabel?: string;
  ariaLabel?: string;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = members.find((m) => m.id === value) ?? null;

  return (
    <div className="relative flex justify-start">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          boxed
            ? "h-9 w-full rounded-md border border-border bg-background px-3 hover:bg-muted/40"
            : "rounded-sm text-xs hover:underline",
          disabled && "cursor-wait opacity-60 no-underline",
          selected ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {selected ? (
          <>
            {selected.avatarUrl ? (
              <MemberAvatar
                name={selected.displayName}
                avatarUrl={selected.avatarUrl}
                className={boxed ? "size-5 text-[0.6rem]" : undefined}
              />
            ) : (
              <PersonIcon className="text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">
              {boxed ? selected.displayName : shortMemberName(selected.displayName)}
            </span>
          </>
        ) : (
          <>
            <PersonIcon className="text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{emptyLabel}</span>
          </>
        )}
        {boxed ? (
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className={cn(
              "ml-auto size-3 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          >
            <path
              fill="currentColor"
              d="M2.2 4.2a.75.75 0 0 1 1.06 0L6 6.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L2.2 5.26a.75.75 0 0 1 0-1.06Z"
            />
          </svg>
        ) : null}
      </button>

      <AnchoredPortal
        open={open && !disabled}
        anchorRef={triggerRef}
        onDismiss={() => setOpen(false)}
        matchAnchorWidth={boxed}
        align="start"
        minWidth={boxed ? undefined : 200}
        maxWidth={280}
        maxHeight={260}
        className="bg-background p-1"
      >
        <ul role="listbox" className="py-0.5">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <PersonIcon />
              {emptyLabel}
            </button>
          </li>
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={m.id === value}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                  m.id === value
                    ? "font-semibold text-foreground"
                    : "text-foreground",
                )}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                {m.avatarUrl ? (
                  <MemberAvatar
                    name={m.displayName}
                    avatarUrl={m.avatarUrl}
                    className="size-5 text-[0.6rem]"
                  />
                ) : (
                  <PersonIcon />
                )}
                <span className="truncate">{m.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      </AnchoredPortal>
    </div>
  );
}
