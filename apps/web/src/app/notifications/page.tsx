import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import {
  listFavoriteStatusNotifications,
  markOwnNotificationsRead,
} from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/notifications");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, notifications_read_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.id) {
    redirect("/login?next=/notifications");
  }

  const { data: notifications, error } = await listFavoriteStatusNotifications(
    supabase,
    {
      userId: profile.id,
      notificationsReadAt: profile.notifications_read_at,
    },
  );

  // Abrir el buzón marca todo como leído (puntito del header).
  await markOwnNotificationsRead(supabase, { userId: profile.id });

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
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface/40">
            {notifications.map((n) => (
              <li key={n.eventId}>
                <Link
                  href={`/tenders/${n.tenderId}`}
                  className="block px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <p className="text-sm font-medium text-foreground">
                    {n.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Estado:{" "}
                    <span className="text-foreground">
                      {formatTenderStatus(n.previousStatus)}
                    </span>
                    {" → "}
                    <span className="font-medium text-foreground">
                      {formatTenderStatus(n.newStatus)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWhen(n.occurredAt)}
                    {n.sourceCode ? ` · ${n.sourceCode}` : null}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
