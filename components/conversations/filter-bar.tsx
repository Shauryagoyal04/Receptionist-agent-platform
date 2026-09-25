"use client";

import { ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/conversations/search-input";
import { DateRangePicker } from "@/components/conversations/date-range-picker";
import { FilterDropdown } from "@/components/conversations/filter-dropdown";
import { useFilterNav } from "@/components/conversations/use-filter-nav";
import { cn } from "@/lib/utils";
import {
  hasActiveUrlFilters,
  type UrlFilterState,
} from "@/lib/conversations/params";
import {
  CHANNEL_LABELS,
  CONVERSATION_STATUSES,
  INTENT_IDS,
  INTENT_LABELS,
  OUTCOMES,
  OUTCOME_TONE,
  STATUS_TONE,
  TONE_DOT_CLASS,
  outcomeLabels,
  statusLabels,
  type Channel,
} from "@/lib/types";

/**
 * Filters for the conversations list.
 *
 * Every facet is a multi-select dropdown and every change is a URL
 * navigation, so the back button walks filter history and any view can be
 * pasted to a colleague. Each trigger shows how many values are selected, so
 * the bar stays one row without hiding that the table is filtered.
 */
export function FilterBar({
  state,
  timeZone,
  enabledChannels,
  showChannelUi,
  handoffEnabled,
}: {
  state: UrlFilterState;
  timeZone: string;
  /** Only these are offered, so no filter can match nothing. */
  enabledChannels: Channel[];
  showChannelUi: boolean;
  handoffEnabled: boolean;
}) {
  const { toggle, apply, clear } = useFilterNav(state);
  const active = hasActiveUrlFilters(state);
  const outcomeLabel = outcomeLabels(handoffEnabled);
  const statusLabel = statusLabels(handoffEnabled);

  return (
    <div className="flex flex-col gap-3">
      {/* Search on the left; the date range and the review filter together on
          the right, since both narrow "which conversations" rather than
          "which kind". */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput state={state} />

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker state={state} timeZone={timeZone} />
          <ReviewFilter
            unreviewedOnly={state.unreviewedOnly}
            onChange={(unreviewedOnly) => apply({ unreviewedOnly })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          legend="Outcome"
          values={OUTCOMES}
          selected={state.outcome}
          labelOf={(value) => outcomeLabel[value]}
          dotOf={(value) => TONE_DOT_CLASS[OUTCOME_TONE[value]]}
          onToggle={(value) => toggle("outcome", value)}
          onClear={() => apply({ outcome: [] })}
        />

        <FilterDropdown
          legend="Status"
          values={CONVERSATION_STATUSES}
          selected={state.status}
          labelOf={(value) => statusLabel[value]}
          dotOf={(value) => TONE_DOT_CLASS[STATUS_TONE[value]]}
          onToggle={(value) => toggle("status", value)}
          onClear={() => apply({ status: [] })}
        />

        <FilterDropdown
          legend="Intent"
          values={INTENT_IDS}
          selected={state.intent}
          labelOf={(value) => INTENT_LABELS[value]}
          onToggle={(value) => toggle("intent", value)}
          onClear={() => apply({ intent: [] })}
        />

        {/* One channel means every option is either "everything" or "nothing". */}
        {showChannelUi && (
          <FilterDropdown
            legend="Channel"
            values={enabledChannels}
            selected={state.channel}
            labelOf={(value) => CHANNEL_LABELS[value]}
            onToggle={(value) => toggle("channel", value)}
            onClear={() => apply({ channel: [] })}
          />
        )}

        {/* Only offered once something is actually filtered, so it does not
            sit there as a dead control on first load. */}
        {active && (
          <Button variant="ghost" size="sm" className="h-8" onClick={clear}>
            <X />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Reviewed state.
 *
 * A radio rather than a checkbox: "all" and "unreviewed only" are two views of
 * the queue, and a dropdown that reads "Review: All" states the current one
 * without needing a separate label beside it.
 */
function ReviewFilter({
  unreviewedOnly,
  onChange,
}: {
  unreviewedOnly: boolean;
  onChange: (unreviewedOnly: boolean) => void;
}) {
  const value = unreviewedOnly ? "unreviewed" : "all";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={
            unreviewedOnly
              ? "Review filter: only unreviewed"
              : "Review filter: all conversations"
          }
          className={cn("h-8 gap-1.5", unreviewedOnly && "border-foreground/30")}
        >
          {unreviewedOnly ? "Unreviewed" : "Review"}
          <ChevronDown className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Review</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next === "unreviewed")}
        >
          <DropdownMenuRadioItem value="all">
            All conversations
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="unreviewed">
            Only unreviewed
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
