import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** La cuenta se gestiona desde el menú del avatar (sin página propia). */
export default function AccountPage() {
  redirect("/");
}
