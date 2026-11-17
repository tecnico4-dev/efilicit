/**
 * Recomendaciones batch (ADR 034). Solo lectura RLS own.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenderInterestKind } from "./tender-ratings";

type Json = Database["public"]["Tables"]["tender_recommendations"]["Row"]["reason"];

export type RecommendationProfileKind = TenderInterestKind;

export type RecommendationItem = {
  tenderId: string;
  profileKind: RecommendationProfileKind;
  score: number;
  reasonLabel: string;
  computedAt: string;
  title: string;
  status: string | null;
  procedureType: string | null;
  contractType: string | null;
  deadlineAt: string | null;
  publicationDate: string | null;
  estimatedValue: number | null;
  currency: string;
  cpvCodes: string[];
};

function asProfileKind(raw: string): RecommendationProfileKind | null {
  if (raw === "propia" || raw === "subcontrata") return raw;
  return null;
}

function reasonLabel(reason: Json): string {
  if (reason && typeof reason === "object" && !Array.isArray(reason)) {
    const label = (reason as { label?: unknown }).label;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  return "Recomendada según tu interés";
}

/**
 * Lista recomendaciones del usuario, agrupadas por perfil.
 * `limitPerKind` acota la home; omitir/null = todas las que pasaron el umbral.
 * Descarta tenders que el usuario haya valorado o guardado tras el cálculo.
 */
export async function listOwnRecommendations(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    limitPerKind?: number | null;
  },
): Promise<{
  data: {
    propia: RecommendationItem[];
    subcontrata: RecommendationItem[];
    computedAt: string | null;
  };
  error: Error | null;
}> {
  const empty = {
    propia: [] as RecommendationItem[],
    subcontrata: [] as RecommendationItem[],
    computedAt: null as string | null,
  };

  const { data: rows, error } = await client
    .from("tender_recommendations")
    .select(
      "tender_id, profile_kind, score, reason, computed_at, tenders ( title, status, procedure_type, contract_type, deadline_at, publication_date, estimated_value, currency, tender_cpvs ( cpv_code ) )",
    )
    .eq("user_id", input.userId)
    .order("score", { ascending: false });

  if (error) return { data: empty, error: new Error(error.message) };

  const { data: ratings } = await client
    .from("tender_ratings")
    .select("tender_id")
    .eq("user_id", input.userId);
  const { data: favs } = await client
    .from("favorites")
    .select("tender_id")
    .eq("user_id", input.userId);

  const hide = new Set<string>([
    ...(ratings ?? []).map((r) => r.tender_id),
    ...(favs ?? []).map((f) => f.tender_id),
  ]);

  const propia: RecommendationItem[] = [];
  const subcontrata: RecommendationItem[] = [];
  let computedAt: string | null = null;

  for (const row of rows ?? []) {
    const kind = asProfileKind(row.profile_kind);
    if (!kind) continue;
    if (hide.has(row.tender_id)) continue;

    const tender = row.tenders as
      | {
          title: string | null;
          status: string | null;
          procedure_type: string | null;
          contract_type: string | null;
          deadline_at: string | null;
          publication_date: string | null;
          estimated_value: number | null;
          currency: string | null;
          tender_cpvs?: { cpv_code: string }[] | null;
        }
      | null;

    const item: RecommendationItem = {
      tenderId: row.tender_id,
      profileKind: kind,
      score: Number(row.score),
      reasonLabel: reasonLabel(row.reason),
      computedAt: row.computed_at,
      title: tender?.title?.trim() || "Sin título",
      status: tender?.status ?? null,
      procedureType: tender?.procedure_type ?? null,
      contractType: tender?.contract_type ?? null,
      deadlineAt: tender?.deadline_at ?? null,
      publicationDate: tender?.publication_date ?? null,
      estimatedValue: tender?.estimated_value ?? null,
      currency: tender?.currency || "EUR",
      cpvCodes: [...(tender?.tender_cpvs ?? []).map((r) => r.cpv_code)].sort(),
    };

    if (!computedAt || row.computed_at > computedAt) {
      computedAt = row.computed_at;
    }

    if (kind === "propia") propia.push(item);
    else subcontrata.push(item);
  }

  const limit = input.limitPerKind;
  return {
    data: {
      propia: limit != null ? propia.slice(0, limit) : propia,
      subcontrata: limit != null ? subcontrata.slice(0, limit) : subcontrata,
      computedAt,
    },
    error: null,
  };
}
