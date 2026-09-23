"use client";

import { usePathname, useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addDaysToDateKey, zonedToday } from "@/lib/time";

const PRESETS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

/**
 * Date range for the analytics page, held in the URL as `?from=&to=`.
 *
 * Presets are computed against the clinic's today, passed from the server, so
 * a manager in another timezone still gets the clinic's last 7 days.
 */
export function RangePicker({
  from,
  to,
  timeZone,
}: {
  from: string;
  to: string;
  timeZone: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const today = zonedToday(timeZone);
  const activePreset =
    to === today
      ? (PRESETS.find((preset) => from === addDaysToDateKey(today, -(preset.days - 1)))
          ?.days ?? null)
      : null;

  function apply(next: { from: string; to: string }) {
    const params = new URLSearchParams();
    params.set("from", next.from);
    params.set("to", next.to);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Date range presets"
        className="flex items-center gap-0.5 rounded-md border p-0.5"
      >
        {PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="button"
            aria-pressed={activePreset === preset.days}
            onClick={() =>
              apply({
                from: addDaysToDateKey(today, -(preset.days - 1)),
                to: today,
              })
            }
            className={cn(
              "rounded-sm px-2 py-1 text-xs transition-colors",
              activePreset === preset.days
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <CalendarRange className="text-muted-foreground size-4 shrink-0" />
        <Input
          type="date"
          value={from}
          max={to}
          onChange={(event) =>
            event.target.value && apply({ from: event.target.value, to })
          }
          aria-label="From date"
          className="h-8 w-[9.5rem] text-xs"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="date"
          value={to}
          min={from}
          onChange={(event) =>
            event.target.value && apply({ from, to: event.target.value })
          }
          aria-label="To date"
          className="h-8 w-[9.5rem] text-xs"
        />
      </div>
    </div>
  );
}
