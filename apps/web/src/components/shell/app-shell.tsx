import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UndoToastProvider } from "@/components/undo-toast";
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
    isAuthenticated = false;
  }

  return (
    <div className="relative flex min-h-full flex-col bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(82,185,216,0.18),transparent_45%)]"
        aria-hidden
      />
      <UndoToastProvider>
        <div className="relative flex min-h-full flex-1 flex-col">
          {isAuthenticated ? <AppHeader isAuthenticated /> : null}
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </UndoToastProvider>
    </div>
  );
}
