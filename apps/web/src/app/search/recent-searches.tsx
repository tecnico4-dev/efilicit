import Link from "next/link";
import { formatCriteriaSummary } from "@/lib/criteria-display";
import { searchHrefFromCriteria } from "@/app/favorites/favorites-shared";
import type { RecentSearch } from "@/lib/queries";

/**
 * Chips de historial junto a Buscar (máx. 5). Click → misma URL de criterios.
 */
export function RecentSearchesList({ items }: { items: RecentSearch[] }) {
  if (items.length === 0) return null;

  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-muted-foreground">Recientes</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => {
          const summary = formatCriteriaSummary(item.criteria);
          return (
            <li key={item.id}>
              <Link
                href={searchHrefFromCriteria(item.criteria)}
                className="inline-block max-w-[16rem] truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary-dark"
                title={summary}
              >
                {summary}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
