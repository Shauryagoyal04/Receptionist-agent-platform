import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Change against the previous period of the same length.
 *
 * Coloured by whether the movement is good for this metric, not by its sign:
 * more "asked for a human" is bad, so +3% is red. Renders nothing when there
 * is no previous period; the page says why once, near the date picker.
 */
export function TrendChip({
  delta,
  increaseIsGood,
  className,
}: {
  delta: number | null;
  increaseIsGood: boolean;
  className?: string;
}) {
  if (delta === null) return null;

  // Under half a percent is noise; an arrow would invite explaining it.
  const flat = Math.abs(delta) < 0.005;
  const rising = delta > 0;
  const good = rising === increaseIsGood;
  const Icon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight;
  const percent = Math.abs(delta * 100);
  const text = flat ? "0%" : `${percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`;

  return (
    <span
      className={cn(
        "tnum inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-xs font-medium",
        flat ? "bg-none-soft text-none-text" : good ? "bg-up-soft text-up-text" : "bg-down-soft text-down-text",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">
        {flat ? "No change" : rising ? "Up" : "Down"} compared with the previous period:
      </span>
      {text}
    </span>
  );
}
