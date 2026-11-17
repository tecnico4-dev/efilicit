import { getSupabaseServerClient } from "@/lib/auth/session";
import { hasOwnVisibleRecommendations } from "@/lib/queries";
import { RecommendationsNavLink } from "./recommendations-nav-link";

/**
 * Solo pinta «Para ti» si hay recomendaciones visibles
 * (mismo criterio que el listado: no valoradas ni en favoritos).
 */
export async function RecommendationsNavGate({
  userId,
}: {
  userId: string;
}) {
  const supabase = await getSupabaseServerClient();
  const { data: visible } = await hasOwnVisibleRecommendations(supabase, {
    userId,
  });
  if (!visible) return null;
  return <RecommendationsNavLink />;
}
