"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayKey } from "@/components/analytics/format";
import { useFilterNav } from "@/components/conversations/use-filter-nav";
import { cn } from "@/lib/utils";
import { zonedToday } from "@/lib/time";
import {
  RANGE_PRESETS,
  activePreset,
  presetRange,
  type UrlFilterState,
} from "@/lib/conversations/params";

/**
 * Date range in one control: all time, three presets, and custom dates in a
 * popover. Native `<input type="date">` inside the popover — keyboard
 * accessible and localized for free, works on a phone, no dependency. The
 * dates are the clinic's calendar days; the server converts them to UTC
 * instants at the edges of the day.
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
  const allTime = !state.from && !state.to;
  const isCustom = !allTime && current === null;
  const today = zonedToday(timeZone);

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ from: state.from, to: state.to });

  const options: Array<{ key: string; label: string; long: string; active: boolean; onClick: () => void }> = [
    {
      key: "all",
      label: "All",
      long: "All time",
      active: allTime,
      onClick: () => apply({ from: "", to: "" }),
    },
    ...RANGE_PRESETS.map((preset) => ({
      key: String(preset.days),
      label: `${preset.days}d`,
      long: `Last ${preset.label}`,
      active: current === preset.days,
      onClick: () => apply(presetRange(preset.days, timeZone)),
    })),
  ];

  return (
    <div className="bg-surface border-line flex h-9 items-center rounded-[10px] border p-0.5">
      <div role="group" aria-label="Date range" className="flex">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={option.active}
            aria-label={option.long}
            onClick={option.onClick}
            className={cn(
              "h-8 min-w-11 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-(--dur-quick)",
              option.active ? "bg-ink text-surface" : "text-ink-3 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <span className="bg-line mx-1 h-5 w-px" aria-hidden="true" />

      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft({ from: state.from, to: state.to });
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-(--dur-quick)",
              isCustom ? "bg-ink text-surface" : "text-ink-2 hover:bg-sunken",
            )}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            <span className="tnum">
              {allTime
                ? "Pick dates"
                : `${formatDayKey(state.from, timeZone)} – ${formatDayKey(state.to, timeZone)}`}
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            className="bg-surface border-line z-50 w-72 rounded-xl border p-4 shadow-(--shadow-pop)"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.from || !draft.to) return;
                const [a, b] =
                  draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];
                apply({ from: a, to: b });
                setOpen(false);
              }}
            >
              <p className="text-ink text-sm font-medium">Custom dates</p>
              <p className="text-ink-3 mt-0.5 text-[13px]">In the clinic&apos;s local time.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-ink-2 flex flex-col gap-1 text-[13px]">
                  From
                  <Input
                    type="date"
                    value={draft.from}
                    max={draft.to || today}
                    onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))}
                    className="h-9 text-[13px]"
                  />
                </label>
                <label className="text-ink-2 flex flex-col gap-1 text-[13px]">
                  To
                  <Input
                    type="date"
                    value={draft.to}
                    min={draft.from || undefined}
                    max={today}
                    onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))}
                    className="h-9 text-[13px]"
                  />
                </label>
              </div>
              <Button type="submit" className="mt-4 w-full" disabled={!draft.from || !draft.to}>
                Show these dates
              </Button>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
