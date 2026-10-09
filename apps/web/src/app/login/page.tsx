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
  const nextPath = first(params.next) || "/";

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
      <div className="relative rounded-2xl border border-border/80 bg-surface/95 p-7 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-surface/90">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Accede con tus credenciales.
        </p>
        <LoginForm nextPath={nextPath.startsWith("/") ? nextPath : "/"} />
        <p className="mt-6 text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-link hover:underline">
            Registrarse
          </Link>
        </p>
      </div>
    </main>
  );
}
