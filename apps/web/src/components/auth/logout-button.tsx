"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

type LogoutButtonProps = {
  className?: string;
  /** Destino tras cerrar sesión (default: inicio público). */
  redirectTo?: string;
};

export function LogoutButton({
  className,
  redirectTo = "/",
}: LogoutButtonProps) {
  const router = useRouter();

  async function onLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className={cn(
        "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted",
        className,
      )}
    >
      Cerrar sesión
    </button>
  );
}
