import type { FavoriteShareDirection } from "@/lib/queries";

/** Circulito Enviada (sky) / Recibida (ámbar), a la izquierda del kind. */
export function ShareDirectionBubble({
  direction,
}: {
  direction: FavoriteShareDirection;
}) {
  const sent = direction === "sent";
  return (
    <span
      className={
        sent
          ? "inline-flex shrink-0 items-center rounded-full border border-sky-600/35 bg-sky-600/12 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:text-sky-200"
          : "inline-flex shrink-0 items-center rounded-full border border-amber-600/35 bg-amber-600/12 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-200"
      }
      title={sent ? "Enviada" : "Recibida"}
    >
      {sent ? "Enviada" : "Recibida"}
    </span>
  );
}
