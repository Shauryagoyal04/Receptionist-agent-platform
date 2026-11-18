"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useFilterNav } from "@/components/conversations/use-filter-nav";
import type { UrlFilterState } from "@/lib/conversations/params";
import {
  CHANNEL_LABELS,
  CONVERSATION_STATUSES,
  INTENT_IDS,
  INTENT_LABELS,
  OUTCOMES,
  OUTCOME_MEANING,
  STATUS_MEANING,
  CHANNEL_MEANING,
  meaningVar,
  outcomeLabels,
  type Meaning,
  statusLabels,
  type Channel,
} from "@/lib/types";

function Dot({ meaning }: { meaning: Meaning }) {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: meaningVar(meaning) }}
    />
  );
}

/**
 * Every facet filter behind one trigger.
 *
 * Sections rather than submenus: a reviewer opening this wants to see what is
 * filtering the table, and a submenu hides exactly that behind another click.
 * The list is capped and scrolls instead, so it can never run off a short
 * screen.
 *
 * The trigger carries a total count, because a collapsed menu would otherwise
 * give no sign that the table is filtered at all.
 */
export function FiltersMenu({
  state,
  enabledChannels,
  showChannelUi,
  handoffEnabled,
}: {
  state: UrlFilterState;
  enabledChannels: Channel[];
  showChannelUi: boolean;
  handoffEnabled: boolean;
}) {
  const { toggle, apply } = useFilterNav(state);
  const outcomeLabel = outcomeLabels(handoffEnabled);
  const statusLabel = statusLabels(handoffEnabled);

  const count =
    state.outcome.length +
    state.status.length +
    state.intent.length +
    (showChannelUi ? state.channel.length : 0) +
    (state.unreviewedOnly ? 1 : 0);

  const active = count > 0;

  /** Ticking a box must not close the menu — filtering is rarely one choice. */
  const keepOpen = (event: Event) => event.preventDefault();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={
            active
              ? `Filters, ${count} applied`
              : "Filters, none applied"
          }
          className={cn(active && "border-agent bg-agent-soft text-agent-text hover:bg-agent-soft")}
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {active && (
            <span className="bg-agent tnum flex size-5 items-center justify-center rounded-full text-[11px] font-semibold text-white">
              {count}
            </span>
          )}
          <ChevronDown className="text-ink-3 size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        // Capped so the menu never exceeds a laptop screen; the sections
        // together run to about two dozen rows.
        className="max-h-[min(70vh,34rem)] w-64 overflow-y-auto rounded-xl shadow-(--shadow-pop)"
      >
        <DropdownMenuLabel>How it ended</DropdownMenuLabel>
        {OUTCOMES.map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={state.outcome.includes(value)}
            onSelect={keepOpen}
            onCheckedChange={() => toggle("outcome", value)}
          >
            <span className="flex items-center gap-2">
              <Dot meaning={OUTCOME_MEANING[value]} />
              {outcomeLabel[value]}
            </span>
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {CONVERSATION_STATUSES.map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={state.status.includes(value)}
            onSelect={keepOpen}
            onCheckedChange={() => toggle("status", value)}
          >
            <span className="flex items-center gap-2">
              <Dot meaning={STATUS_MEANING[value]} />
              {statusLabel[value]}
            </span>
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Asked about</DropdownMenuLabel>
        {INTENT_IDS.map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={state.intent.includes(value)}
            onSelect={keepOpen}
            onCheckedChange={() => toggle("intent", value)}
          >
            {INTENT_LABELS[value]}
          </DropdownMenuCheckboxItem>
        ))}

        {/* One channel means every option is either everything or nothing. */}
        {showChannelUi && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Channel</DropdownMenuLabel>
            {enabledChannels.map((value) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={state.channel.includes(value)}
                onSelect={keepOpen}
                onCheckedChange={() => toggle("channel", value)}
              >
                <span className="flex items-center gap-2">
                  <Dot meaning={CHANNEL_MEANING[value]} />
                  {CHANNEL_LABELS[value]}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Review</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={state.unreviewedOnly ? "unreviewed" : "all"}
          onValueChange={(next) =>
            apply({ unreviewedOnly: next === "unreviewed" })
          }
        >
          <DropdownMenuRadioItem value="all" onSelect={keepOpen}>
            All conversations
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="unreviewed" onSelect={keepOpen}>
            Only unreviewed
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {active && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={() =>
                apply({
                  outcome: [],
                  status: [],
                  intent: [],
                  channel: [],
                  unreviewedOnly: false,
                })
              }
              className="text-agent-text hover:bg-sunken flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium"
            >
              <X className="size-3.5" />
              Clear all filters
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
