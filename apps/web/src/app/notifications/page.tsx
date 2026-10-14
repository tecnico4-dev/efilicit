import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/notifications");
  }

  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Notificaciones
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aquí verás avisos sobre tus alertas y seguimiento.
      </p>
      <p className="mt-8 rounded-lg border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Todavía no tienes notificaciones.
      </p>
    </main>
  );
}
