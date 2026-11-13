import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  isNotificationInTrashWindow,
  listFavoriteStatusNotifications,
  listOwnCommonInboxNotifications,
  listOwnCommonRemovedInboxNotifications,
  listOwnDigestInboxNotifications,
} from "@/lib/queries";
import {
  NotificationsList,
  type InboxItem,
} from "./notifications-list";
import type { NotificationsView } from "./notifications-folder-tabs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function itemTrashedAt(item: InboxItem): string | null {
  return item.data.trashedAt;
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

  const supabase = await getSupabaseServerClient();
  const { data: profile, error: profileError } = await getSessionProfile();

  if (!profile?.id) {
    return (
      <main className={PAGE_MAIN_CLASS}>
        <ErrorState>
          No hay perfil en public.users:{" "}
          {profileError?.message ?? "desconocido"}
        </ErrorState>
      </main>
    );
  }

  const [favResult, digestResult, commonResult, commonRemovedResult] =
    await Promise.all([
      listFavoriteStatusNotifications(supabase, { userId: profile.id }),
      listOwnDigestInboxNotifications(supabase, { userId: profile.id }),
      listOwnCommonInboxNotifications(supabase, { userId: profile.id }),
      listOwnCommonRemovedInboxNotifications(supabase, {
        userId: profile.id,
      }),
    ]);

  const error =
    favResult.error ??
    digestResult.error ??
    commonResult.error ??
    commonRemovedResult.error;

  const items: InboxItem[] = [
    ...favResult.data.map(
      (data): InboxItem => ({
        kind: "favorite_status",
        sortAt: data.detectedAt,
        data,
      }),
    ),
    ...digestResult.data.map(
      (data): InboxItem => ({
        kind: "digest",
        sortAt: data.sentAt,
        data,
      }),
    ),
    ...commonResult.data.map(
      (data): InboxItem => ({
        kind: "common",
        sortAt: data.sharedAt,
        data,
      }),
    ),
    ...commonRemovedResult.data.map(
      (data): InboxItem => ({
        kind: "common_removed",
        sortAt: data.removedAt,
        data,
      }),
    ),
  ].sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));

  const hasActive = items.some((n) => itemTrashedAt(n) == null);
  const hasTrash = items.some((n) => {
    const trashedAt = itemTrashedAt(n);
    return trashedAt != null && isNotificationInTrashWindow(trashedAt);
  });
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
            items={items}
            initialView={view}
            userId={profile.id}
          />
        )}
      </div>
    </main>
  );
}
