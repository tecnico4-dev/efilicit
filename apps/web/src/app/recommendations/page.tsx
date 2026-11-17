import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  PAGE_MAIN_FAVORITES_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { listOwnRecommendations } from "@/lib/queries";
import { RecommendationsSection } from "./recommendations-section";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  let supabase;
  try {
    supabase = await getSupabaseServerClient();
  } catch {
    return (
      <main className={PAGE_MAIN_FAVORITES_CLASS}>
        <ErrorState>No se pudo conectar con la base de datos.</ErrorState>
      </main>
    );
  }

  const profile = await getSessionProfile();
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_FAVORITES_CLASS}>
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
    <main className={PAGE_MAIN_FAVORITES_CLASS}>
      <div className={PAGE_TITLE_RULE}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Recomendaciones para ti
        </h1>
      </div>

      {error ? (
        <ErrorState className="mt-6">
          No se pudieron cargar recomendaciones: {error.message}
        </ErrorState>
      ) : (
        <RecommendationsSection
          userId={userId}
          propia={data.propia}
          subcontrata={data.subcontrata}
          computedAt={data.computedAt}
        />
      )}
    </main>
  );
}
