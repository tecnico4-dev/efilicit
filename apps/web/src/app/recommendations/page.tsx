import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { PAGE_MAIN_MEDIUM_CLASS } from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { listOwnRecommendations } from "@/lib/queries";
import { HomeRecommendations } from "../home-recommendations";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  let supabase;
  try {
    supabase = await getSupabaseServerClient();
  } catch {
    return (
      <main className={PAGE_MAIN_MEDIUM_CLASS}>
        <ErrorState>No se pudo conectar con la base de datos.</ErrorState>
      </main>
    );
  }

  const profile = await getSessionProfile();
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_MEDIUM_CLASS}>
        <ErrorState>Sesión sin perfil de aplicación.</ErrorState>
      </main>
    );
  }

  const userId = profile.data.id;
  const { data, error } = await listOwnRecommendations(supabase, {
    userId,
    limitPerKind: null,
  });

  return (
    <main className={PAGE_MAIN_MEDIUM_CLASS}>
      {error ? (
        <ErrorState>
          No se pudieron cargar recomendaciones: {error.message}
        </ErrorState>
      ) : (
        <HomeRecommendations
          userId={userId}
          propia={data.propia}
          subcontrata={data.subcontrata}
          computedAt={data.computedAt}
        />
      )}
    </main>
  );
}
