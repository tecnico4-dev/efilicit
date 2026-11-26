/**
 * Intake estructurado inmediato (sin PDFs): lee RAW, parsea, vuelca offer_*.
 * Deja offer_case_intake en pending para el worker de descargas (ADR 035).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@efilicit/types";
import { applyIntakePlan, type ApplyStats } from "./apply";
import { buildIntakePlan, targetLotIds } from "./plan";
import {
  OfferTermsParseError,
  parseOfferTerms,
} from "./placsp-terms";

export const PLACSP_SOURCE_CODES = [
  "placsp",
  "placsp_agregadas",
  "placsp_menores",
] as const;

const SYNC_TIMEOUT_MS = 12_000;

export type StructuredIntakeResult =
  | { ok: true; stats: ApplyStats; skipped?: undefined }
  | { ok: true; stats: ApplyStats; skipped: string }
  | { ok: false; error: string };

type CaseSource = {
  target_lots: unknown;
  source_code: string | null;
  storage_path: string | null;
};

export async function runStructuredOfferIntake(
  admin: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<StructuredIntakeResult> {
  try {
    return await withTimeout(
      runInner(admin, offerCaseId),
      SYNC_TIMEOUT_MS,
      "timeout sync intake",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message.slice(0, 500) };
  }
}

async function runInner(
  admin: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<StructuredIntakeResult> {
  const source = await loadCaseSource(admin, offerCaseId);
  if (!source) {
    return { ok: false, error: "offer_case not found" };
  }
  if (!source.source_code || !source.storage_path) {
    return {
      ok: true,
      stats: emptyStats(),
      skipped: "no_placsp_raw",
    };
  }
  if (
    !PLACSP_SOURCE_CODES.includes(
      source.source_code as (typeof PLACSP_SOURCE_CODES)[number],
    )
  ) {
    return {
      ok: true,
      stats: emptyStats(),
      skipped: "non_placsp",
    };
  }

  const raw = await downloadRaw(admin, source.storage_path);
  let extract;
  try {
    extract = parseOfferTerms(raw);
  } catch (err) {
    if (err instanceof OfferTermsParseError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const plan = buildIntakePlan(extract, targetLotIds(source.target_lots));
  const stats = await applyIntakePlan(admin, offerCaseId, plan);
  return { ok: true, stats };
}

async function loadCaseSource(
  admin: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<CaseSource | null> {
  const { data: oc, error } = await admin
    .from("offer_cases")
    .select("id, target_lots, tender_id")
    .eq("id", offerCaseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!oc) return null;

  const { data: sources, error: srcErr } = await admin
    .from("tender_sources")
    .select("source_code, artifact_id")
    .eq("tender_id", oc.tender_id)
    .in("source_code", [...PLACSP_SOURCE_CODES]);
  if (srcErr) throw new Error(srcErr.message);

  const artifactIds = (sources ?? [])
    .map((s) => s.artifact_id)
    .filter((id): id is string => id != null);
  if (artifactIds.length === 0) {
    return {
      target_lots: oc.target_lots,
      source_code: sources?.[0]?.source_code ?? null,
      storage_path: null,
    };
  }

  const { data: artifacts, error: artErr } = await admin
    .from("source_artifacts")
    .select("id, storage_path, downloaded_at")
    .in("id", artifactIds)
    .not("storage_path", "is", null)
    .order("downloaded_at", { ascending: false, nullsFirst: false });
  if (artErr) throw new Error(artErr.message);

  const best = artifacts?.[0];
  if (!best?.storage_path) {
    return {
      target_lots: oc.target_lots,
      source_code: sources?.[0]?.source_code ?? null,
      storage_path: null,
    };
  }

  const matched = (sources ?? []).find((s) => s.artifact_id === best.id);
  return {
    target_lots: oc.target_lots,
    source_code: matched?.source_code ?? sources?.[0]?.source_code ?? null,
    storage_path: best.storage_path,
  };
}

function splitStoragePath(storagePath: string): { bucket: string; key: string } {
  const trimmed = storagePath.replace(/^\/+/, "");
  const idx = trimmed.indexOf("/");
  if (idx <= 0) throw new Error(`invalid storage_path: ${storagePath}`);
  return {
    bucket: trimmed.slice(0, idx),
    key: trimmed.slice(idx + 1),
  };
}

async function downloadRaw(
  admin: SupabaseClient<Database>,
  storagePath: string,
): Promise<Buffer> {
  const { bucket, key } = splitStoragePath(storagePath);
  const { data, error } = await admin.storage.from(bucket).download(key);
  if (error || !data) {
    throw new Error(error?.message || `Storage download failed for ${storagePath}`);
  }
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

function emptyStats(): ApplyStats {
  return { pliegos: 0, requirements: 0, deliverables: 0, milestones: 0 };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
