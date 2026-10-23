import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  isNotificationInTrashWindow,
  listFavoriteStatusNotifications,
} from "@/lib/queries";
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
    viewParam === "unread"
      ? "unread"
      : viewParam === "trash"
        ? "trash"
        : "all";

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

  const hasActive = notifications.some((n) => n.trashedAt == null);
  const hasTrash = notifications.some(
    (n) => n.trashedAt != null && isNotificationInTrashWindow(n.trashedAt),
  );
  const showList = hasActive || hasTrash || view === "trash";

  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Notificaciones
      </h1>

      <div className={PAGE_TITLE_RULE}>
        {error ? (
          <ErrorState>
            No se pudieron cargar las notificaciones: {error.message}
          </ErrorState>
        ) : !showList ? (
          <EmptyState>Aún no tienes notificaciones.</EmptyState>
        ) : (
          <NotificationsList
            notifications={notifications}
            view={view}
            userId={profile.id}
          />
        )}
      </div>
    </main>
  );
}
