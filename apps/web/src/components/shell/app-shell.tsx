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
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <AppHeader isAuthenticated={isAuthenticated} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
