import Link from "next/link";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col bg-background px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Crear cuenta
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Regístrate para guardar alertas y personalizar tu seguimiento.
      </p>
      <RegisterForm />
      <p className="mt-6 text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-link hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </main>
  );
}
