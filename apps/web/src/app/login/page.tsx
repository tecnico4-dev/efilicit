import Link from "next/link";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextPath = first(params.next) || "/account";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="hover:underline">
          EfiLicit
        </Link>
        <span className="mx-2">/</span>
        Login
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
        Iniciar sesión
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Semana 5 — Auth local (Supabase). Tras el login debe existir fila en{" "}
        <code className="font-mono">public.users</code>.
      </p>
      <LoginForm nextPath={nextPath.startsWith("/") ? nextPath : "/account"} />
    </main>
  );
}
