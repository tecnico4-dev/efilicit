import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

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
    .select("id, auth_user_id, display_name, created_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/" className="hover:underline">
              EfiLicit
            </Link>
            <span className="mx-2">/</span>
            Cuenta
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Tu perfil
          </h1>
        </div>
        <LogoutButton />
      </div>

      <dl className="mt-8 space-y-3 text-sm">
        <div>
          <dt className="text-zinc-500">Email (Auth)</dt>
          <dd className="font-mono text-zinc-900">{user.email}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">auth.users id</dt>
          <dd className="font-mono text-zinc-900">{user.id}</dd>
        </div>
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-red-900" role="alert">
            No se pudo leer public.users: {error.message}
          </p>
        ) : profile ? (
          <>
            <div>
              <dt className="text-zinc-500">public.users id</dt>
              <dd className="font-mono text-zinc-900">{profile.id}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">display_name</dt>
              <dd className="text-zinc-900">{profile.display_name ?? "—"}</dd>
            </div>
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">
              Sync Auth → public.users OK.
            </p>
          </>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
            Sesión OK, pero no hay fila en public.users (revisa trigger / seed).
          </p>
        )}
      </dl>

      <p className="mt-8 text-sm">
        <Link href="/search" className="text-zinc-900 underline">
          Ir a búsqueda
        </Link>
        {" · "}
        <Link href="/alerts" className="text-zinc-900 underline">
          Alertas
        </Link>
      </p>
    </main>
  );
}
