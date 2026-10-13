import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Registro público deshabilitado (ADR 016): usuarios solo por administración. */
export default function RegisterPage() {
  redirect("/login");
}
