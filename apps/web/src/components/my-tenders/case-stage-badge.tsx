import { BID_STAGE_LABELS, type BidStage } from "@/lib/queries";
import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  interes: "border-sky-300/60 bg-sky-50 text-sky-900",
  preparacion: "border-amber-300/60 bg-amber-50 text-amber-950",
  presentada: "border-primary/40 bg-primary/10 text-link",
  adjudicada: "border-emerald-300/60 bg-emerald-50 text-emerald-900",
  no_adjudicada: "border-border bg-muted text-muted-foreground",
  descartada: "border-border bg-muted text-muted-foreground",
};

function stageLabel(stage: string): string {
  if (stage in BID_STAGE_LABELS) {
    return BID_STAGE_LABELS[stage as BidStage];
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
