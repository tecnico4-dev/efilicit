import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DigestFrequency } from "@/lib/queries";
import { UndoToastProvider } from "@/components/undo-toast";
import { AppHeader } from "./app-header";

function displayNameFrom(
  profileName: string | null | undefined,
  metaName: unknown,
  email: string | null | undefined,
): string {
  if (profileName?.trim()) return profileName.trim();
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? "Usuario";
  return "Usuario";
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  let isAuthenticated = false;
  let displayName = "Usuario";
  let userId = "";
  let digestFrequency: DigestFrequency = "diaria";
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("id, display_name, digest_frequency")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      displayName = displayNameFrom(
        profile?.display_name,
        user.user_metadata?.display_name,
        user.email,
      );
      userId = profile?.id ?? "";
      digestFrequency =
        profile?.digest_frequency === "semanal" ? "semanal" : "diaria";
    }
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(82,185,216,0.18),transparent_45%)]"
        aria-hidden
      />
      <UndoToastProvider>
        <div className="relative flex min-h-full flex-1 flex-col">
          {isAuthenticated ? (
            <AppHeader
              isAuthenticated
              displayName={displayName}
              userId={userId}
              digestFrequency={digestFrequency}
            />
          ) : null}
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </UndoToastProvider>
    </div>
  );
}
