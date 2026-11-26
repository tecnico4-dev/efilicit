"use server";

/**
 * Sync estructurado al alta / reprocesar (ADR 035).
 * service_role solo en servidor para RAW + volcado; comprueba sesión + acceso al expediente.
 */
import { createOfferIntakeAdminClient } from "@/server/offer-intake/admin";
import { runStructuredOfferIntake } from "@/server/offer-intake/run-structured";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StructuredIntakeActionResult = {
  ok: boolean;
  skipped?: string;
  stats?: {
    pliegos: number;
    requirements: number;
    deliverables: number;
    milestones: number;
  };
  error?: string;
};

export async function applyStructuredOfferIntake(
  offerCaseId: string,
): Promise<StructuredIntakeActionResult> {
  if (!offerCaseId || typeof offerCaseId !== "string") {
    return { ok: false, error: "invalid offer_case_id" };
  }

  const userClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  // Acceso al expediente vía RLS del usuario (is_app_user).
  const { data: accessible, error: accessErr } = await userClient
    .from("offer_cases")
    .select("id")
    .eq("id", offerCaseId)
    .maybeSingle();
  if (accessErr) {
    return { ok: false, error: accessErr.message };
  }
  if (!accessible) {
    return { ok: false, error: "forbidden" };
  }

  const admin = createOfferIntakeAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "missing_service_role",
    };
  }

  const result = await runStructuredOfferIntake(admin, offerCaseId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    skipped: result.skipped,
    stats: result.stats,
  };
}
