"use client";

import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFilterNav } from "@/components/conversations/use-filter-nav";
import { cn } from "@/lib/utils";
import {
  RANGE_PRESETS,
  activePreset,
  presetRange,
  type UrlFilterState,
} from "@/lib/conversations/params";

/**
 * Date range control: three presets plus two native date inputs for a custom
 * range.
 *
 * Native `<input type="date">` rather than a calendar widget — it is
 * keyboard-accessible and localized for free, works on a phone, and adds no
 * dependency. The dates are the clinic's calendar days; the server converts
 * them to UTC instants at the edges of the day.
 */
export function DateRangePicker({
  state,
  timeZone,
}: {
  state: UrlFilterState;
  /**
   * Passed from the server so presets are computed against the clinic's
   * "today", not the browser's — a receptionist in a different timezone must
   * still get the clinic's last 7 days.
   */
  timeZone: string;
}) {
  const { apply } = useFilterNav(state);
  const current = activePreset(state, timeZone);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Date range presets"
        className="flex items-center gap-0.5 rounded-md border p-0.5"
      >
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="button"
            aria-pressed={current === preset.days}
            onClick={() => apply(presetRange(preset.days, timeZone))}
            className={cn(
              "rounded-sm px-2 py-1 text-xs transition-colors",
              current === preset.days
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
          value={state.from}
          max={state.to || undefined}
          onChange={(event) => apply({ from: event.target.value })}
          aria-label="From date"
          className="h-8 w-[9.5rem] text-xs"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="date"
          value={state.to}
          min={state.from || undefined}
          onChange={(event) => apply({ to: event.target.value })}
          aria-label="To date"
          className="h-8 w-[9.5rem] text-xs"
        />
      </div>

      {(state.from || state.to) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => apply({ from: "", to: "" })}
        >
          All time
        </Button>
      )}
    </div>
  );
}
