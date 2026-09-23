"use client";

import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/conversations/search-input";
import { DateRangePicker } from "@/components/conversations/date-range-picker";
import { useFilterNav } from "@/components/conversations/use-filter-nav";
import { cn } from "@/lib/utils";
import {
  hasActiveUrlFilters,
  type UrlFilterState,
} from "@/lib/conversations/params";
import {
  CHANNELS,
  CHANNEL_LABELS,
  CONVERSATION_STATUSES,
  INTENT_IDS,
  INTENT_LABELS,
  OUTCOMES,
  OUTCOME_LABELS,
  OUTCOME_TONE,
  STATUS_LABELS,
  STATUS_TONE,
  TONE_DOT_CLASS,
} from "@/lib/types";

/**
 * Filter chips for the conversations list.
 *
 * Every group is multi-select and every change is a URL navigation, so the
 * back button walks filter history and any view can be pasted to a colleague.
 * Chips rather than dropdowns because the active filters then stay visible
 * while scanning the table — the whole point is fast triage.
 */
export function FilterBar({
  state,
  timeZone,
}: {
  state: UrlFilterState;
  timeZone: string;
}) {
  const { toggle, apply, clear } = useFilterNav(state);
  const active = hasActiveUrlFilters(state);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput state={state} />

        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker state={state} timeZone={timeZone} />

          <div className="flex items-center gap-2">
            <Switch
              id="unreviewed"
              checked={state.unreviewedOnly}
              onCheckedChange={(checked) =>
                apply({ unreviewedOnly: checked === true })
              }
            />
            <Label htmlFor="unreviewed" className="cursor-pointer">
              Only unreviewed
            </Label>
          </div>

          {/* Only offered once something is actually filtered, so it does not
              sit there as a dead control on first load. */}
          {active && (
            <Button variant="ghost" size="sm" onClick={clear}>
              <X />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <ChipGroup
          legend="Outcome"
          values={OUTCOMES}
          selected={state.outcome}
          labelOf={(value) => OUTCOME_LABELS[value]}
          dotOf={(value) => TONE_DOT_CLASS[OUTCOME_TONE[value]]}
          onToggle={(value) => toggle("outcome", value)}
        />
        <ChipGroup
          legend="Status"
          values={CONVERSATION_STATUSES}
          selected={state.status}
          labelOf={(value) => STATUS_LABELS[value]}
          dotOf={(value) => TONE_DOT_CLASS[STATUS_TONE[value]]}
          onToggle={(value) => toggle("status", value)}
        />
        <ChipGroup
          legend="Intent"
          values={INTENT_IDS}
          selected={state.intent}
          labelOf={(value) => INTENT_LABELS[value]}
          onToggle={(value) => toggle("intent", value)}
        />
        <ChipGroup
          legend="Channel"
          values={CHANNELS}
          selected={state.channel}
          labelOf={(value) => CHANNEL_LABELS[value]}
          onToggle={(value) => toggle("channel", value)}
        />
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  legend,
  values,
  selected,
  labelOf,
  dotOf,
  onToggle,
}: {
  legend: string;
  values: readonly T[];
  selected: readonly T[];
  labelOf: (value: T) => string;
  dotOf?: (value: T) => string;
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{legend}</legend>
      <span className="text-muted-foreground w-16 shrink-0 text-xs">
        {legend}
      </span>
      {values.map((value) => {
        const isSelected = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            // A toggle button, not a link: `aria-pressed` is what tells a
            // screen reader this filter is currently on.
            aria-pressed={isSelected}
            onClick={() => onToggle(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
              isSelected
                ? "border-foreground/20 bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {isSelected ? (
              <Check className="size-3" />
            ) : dotOf ? (
              <span className={cn("size-1.5 rounded-full", dotOf(value))} />
            ) : null}
            {labelOf(value)}
          </button>
        );
      })}
    </fieldset>
  );
}
