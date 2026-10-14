import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DigestFrequency } from "@/lib/queries";
import { LogoutButton } from "./logout-button";
import { ChangePasswordForm } from "./change-password-form";
import { DigestFrequencyForm } from "./digest-frequency-form";

export const dynamic = "force-dynamic";

function asDigestFrequency(value: string | null | undefined): DigestFrequency {
  return value === "weekly" ? "weekly" : "daily";
}

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, digest_frequency")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tu perfil
        </h1>
        <LogoutButton />
      </div>

      <dl className="mt-8 space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-mono text-foreground">{user.email}</dd>
        </div>
        {error ? (
          <p className="rounded-md bg-surface px-3 py-2 text-destructive" role="alert">
            No se pudo leer public.users: {error.message}
          </p>
        ) : !profile ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
            Sesión OK, pero no hay fila en public.users (revisa trigger / seed).
          </p>
        ) : null}
      </dl>

      <section className="mt-10 rounded-md border border-border bg-background p-4">
        <h2 className="text-base font-medium text-foreground">
          Cambiar contraseña
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Puedes actualizarla cuando quieras.
        </p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>

      {profile ? (
        <DigestFrequencyForm
          userId={profile.id}
          initialFrequency={asDigestFrequency(profile.digest_frequency)}
        />
      ) : null}
    </main>
  );
}
