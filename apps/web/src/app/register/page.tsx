import Link from "next/link";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col bg-background px-6 py-10">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          EfiLicit
        </Link>
        <span className="mx-2">/</span>
        Registro
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Crear cuenta
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Semana 5 — al registrarte se crea el perfil en{" "}
        <code className="font-mono">public.users</code> (trigger).
      </p>
      <RegisterForm />
      <p className="mt-6 text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="underline">
          Iniciar sesión
        </Link>
      </p>
    </main>
  );
}
