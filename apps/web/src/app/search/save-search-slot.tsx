import { getSessionProfile } from "@/lib/auth/session";
import { SaveSearchButton } from "./save-search-button";

/** Botón «Guardar búsqueda» tras resolver perfil (Suspense; no bloquea el form). */
export async function SaveSearchSlot() {
  const { data: profile } = await getSessionProfile();
  if (!profile?.id) return null;
  return <SaveSearchButton userId={profile.id} />;
}
