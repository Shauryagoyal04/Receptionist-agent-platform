"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayKey } from "@/components/analytics/format";
import { cn } from "@/lib/utils";
import { addDaysToDateKey, zonedToday } from "@/lib/time";

const PRESETS = [
  { days: 7, label: "7d", long: "Last 7 days" },
  { days: 30, label: "30d", long: "Last 30 days" },
  { days: 90, label: "90d", long: "Last 90 days" },
] as const;

/**
 * Presets and custom dates in one control, held in the URL as `?from=&to=`.
 *
 * Presets are computed against the clinic's today, passed from the server,
 * so a manager in another timezone still gets the clinic's last 7 days. The
 * selected pill slides to the new option rather than jumping.
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
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ from, to });

  const today = zonedToday(timeZone);
  const activeIndex =
    to === today
      ? PRESETS.findIndex((preset) => from === addDaysToDateKey(today, -(preset.days - 1)))
      : -1;
  const isCustom = activeIndex === -1;

  function apply(next: { from: string; to: string }) {
    const params = new URLSearchParams({ from: next.from, to: next.to });
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  // Segments are a fixed width so the pill can slide by a known distance.
  const SEG = 48;

  return (
    <div
      className={cn(
        "bg-surface border-line flex h-9 items-center rounded-[10px] border p-0.5 transition-opacity",
        pending && "opacity-70",
      )}
      aria-busy={pending}
    >
      <div role="group" aria-label="Date range" className="relative flex">
        {!isCustom && (
          <span
            aria-hidden="true"
            className="bg-ink absolute inset-y-0 left-0 rounded-lg transition-transform duration-(--dur-base) ease-(--ease-in-out)"
            style={{ width: SEG, transform: `translateX(${activeIndex * SEG}px)` }}
          />
        )}
        {PRESETS.map((preset, index) => (
          <button
            key={preset.days}
            type="button"
            aria-pressed={activeIndex === index}
            aria-label={preset.long}
            onClick={() =>
              apply({ from: addDaysToDateKey(today, -(preset.days - 1)), to: today })
            }
            style={{ width: SEG }}
            className={cn(
              "relative z-10 h-8 rounded-lg text-[13px] font-medium transition-colors duration-(--dur-quick)",
              activeIndex === index ? "text-surface" : "text-ink-3 hover:text-ink",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <span className="bg-line mx-1 h-5 w-px" aria-hidden="true" />

      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft({ from, to });
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
              {formatDayKey(from, timeZone)} – {formatDayKey(to, timeZone)}
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
                const [a, b] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];
                apply({ from: a, to: b });
                setOpen(false);
              }}
            >
              <p className="text-ink text-sm font-medium">Custom dates</p>
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
                    min={draft.from}
                    max={today}
                    onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))}
                    className="h-9 text-[13px]"
                  />
                </label>
              </div>
              <Button type="submit" className="mt-4 w-full">
                Show these dates
              </Button>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
