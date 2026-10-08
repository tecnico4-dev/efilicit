"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { addOwnFavorite, removeOwnFavorite } from "@/lib/queries";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 5.072a5 5 0 1 1 7.5 7.5Z" />
    </svg>
  );
}

/**
 * Corazón en lista de resultados: vacío = no favorito; rojo = favorito.
 * Solo se monta con sesión.
 */
export function FavoriteHeartButton({
  userId,
  tenderId,
  initiallyFavorited,
}: {
  userId: string;
  tenderId: string;
  initiallyFavorited: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, setPending] = useState(false);

  async function onToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    setPending(true);
    const client = createSupabaseBrowserClient();
    const prev = favorited;
    setFavorited(!prev);

    if (prev) {
      const { error } = await removeOwnFavorite(client, { userId, tenderId });
      if (error) setFavorited(prev);
    } else {
      const { error } = await addOwnFavorite(client, { userId, tenderId });
      if (error) setFavorited(prev);
    }

    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onToggle}
      aria-label={favorited ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={favorited}
      className={cn(
        "shrink-0 rounded-md p-1.5 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
        favorited
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted",
      )}
    >
      <HeartIcon filled={favorited} />
    </button>
  );
}
