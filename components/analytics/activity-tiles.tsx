import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { CountUp } from "@/components/analytics/count-up";
import { Sparkline } from "@/components/analytics/sparkline";
import { TrendChip } from "@/components/analytics/trend-chip";
import type { MetricKind } from "@/components/analytics/format";
import { meaningVar, type Meaning } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ActivityTile = {
  id: string;
  label: string;
  icon: LucideIcon;
  meaning: Meaning;
  value: number;
  kind: MetricKind;
  delta: number | null;
  increaseIsGood: boolean;
  /** Daily values across the range. */
  series: number[];
  /** One plain-language breakdown under the number. */
  context?: string;
  /** Where the tile goes: the list behind the number. */
  href: string;
};

/**
 * The supporting metrics, as one container split 2×2 by hairlines rather
 * than four floating cards. Each tile is a link to the list behind its
 * number; on hover an arrow fades in and the sparkline's fill deepens.
 */
export function ActivityTiles({ tiles }: { tiles: ActivityTile[] }) {
  return (
    <section
      aria-label="Activity"
      className="bg-surface border-line grid min-w-0 grid-cols-1 overflow-hidden rounded-xl border sm:grid-cols-2"
    >
      {tiles.map((tile, index) => (
        <Tile
          key={tile.id}
          tile={tile}
          className={cn(
            // Hairline dividers between tiles, never on the outer edge.
            index > 0 && "border-line border-t",
            index === 1 && "sm:border-t-0",
            index % 2 === 1 && "sm:border-l",
          )}
        />
      ))}
    </section>
  );
}

function Tile({ tile, className }: { tile: ActivityTile; className?: string }) {
  const Icon = tile.icon;
  return (
    <Link
      href={tile.href}
      className={cn(
        "group/tile hover:bg-surface-hover relative flex min-w-0 flex-col p-5 transition-colors duration-(--dur-quick) focus-visible:-outline-offset-2",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: meaningVar(tile.meaning, "soft"), color: meaningVar(tile.meaning) }}
        >
          <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="text-ink-2 truncate text-sm font-medium">{tile.label}</span>
        <ArrowUpRight
          aria-hidden="true"
          className="text-ink-3 ml-auto size-4 shrink-0 -translate-x-0.5 translate-y-0.5 opacity-0 transition duration-(--dur-quick) group-hover/tile:translate-x-0 group-hover/tile:translate-y-0 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100"
        />
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <CountUp
          value={tile.value}
          kind={tile.kind}
          className="tnum text-ink text-[32px] leading-[38px] font-semibold tracking-[-0.01em]"
        />
        <TrendChip delta={tile.delta} increaseIsGood={tile.increaseIsGood} />
      </div>

      <Sparkline values={tile.series} color={meaningVar(tile.meaning)} className="mt-3" />

      {tile.context && (
        <p className="text-ink-3 mt-2 truncate text-[13px] leading-[18px]">{tile.context}</p>
      )}
    </Link>
  );
}
