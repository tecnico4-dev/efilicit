import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { listFavoriteStatusNotifications } from "@/lib/queries";
import { NotificationsList } from "./notifications-list";
import type { NotificationsView } from "./notifications-folder-tabs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const viewParam = first(params.view);
  const view: NotificationsView =
    viewParam === "unread" ? "unread" : "all";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/notifications");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.id) {
    redirect("/login?next=/notifications");
  }

  const { data: notifications, error } = await listFavoriteStatusNotifications(
    supabase,
    { userId: profile.id },
  );

  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Notificaciones
      </h1>

      <div className={PAGE_TITLE_RULE}>
        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            No se pudieron cargar las notificaciones: {error.message}
          </p>
        ) : notifications.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no tienes notificaciones.
          </p>
        ) : (
          <NotificationsList notifications={notifications} view={view} />
        )}
      </div>
    </main>
  );
}
