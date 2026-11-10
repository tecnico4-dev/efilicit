import { OFFER_STAGE_LABELS, type OfferStage } from "@/lib/queries";
import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  interes: "border-sky-300/60 bg-sky-50 text-sky-900",
  analisis: "border-indigo-300/60 bg-indigo-50 text-indigo-950",
  preparacion: "border-amber-300/60 bg-amber-50 text-amber-950",
  presentada: "border-primary/40 bg-primary/10 text-link",
  en_evaluacion: "border-cyan-300/60 bg-cyan-50 text-cyan-950",
  requerimiento: "border-orange-300/60 bg-orange-50 text-orange-950",
  adjudicada: "border-emerald-300/60 bg-emerald-50 text-emerald-900",
  no_adjudicada: "border-border bg-muted text-muted-foreground",
  descartada: "border-border bg-muted text-muted-foreground",
  subcontrata: "border-violet-300/60 bg-violet-50 text-violet-950",
  desierta: "border-border bg-muted text-muted-foreground",
};

function stageLabel(stage: string): string {
  if (stage in OFFER_STAGE_LABELS) {
    return OFFER_STAGE_LABELS[stage as OfferStage];
  }
  return stage.replaceAll("_", " ");
}

export function CaseStageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONE[stage] ?? "border-border bg-muted text-foreground",
      )}
    >
      {stageLabel(stage)}
    </span>
  );
}
