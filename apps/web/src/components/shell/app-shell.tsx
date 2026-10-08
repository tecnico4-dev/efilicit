import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppHeader } from "./app-header";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let isAuthenticated = false;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  } catch {
    // Sin env local / Supabase caído: tratar como anónimo (nav pública).
    isAuthenticated = false;
  }

  return (
    <div className="relative flex min-h-full flex-col bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(82,185,216,0.18),transparent_45%)]"
        aria-hidden
      />
      <div className="relative flex min-h-full flex-1 flex-col">
        <AppHeader isAuthenticated={isAuthenticated} />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
