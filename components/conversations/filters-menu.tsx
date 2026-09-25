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
  OUTCOME_TONE,
  STATUS_TONE,
  TONE_DOT_CLASS,
  outcomeLabels,
  statusLabels,
  type Channel,
} from "@/lib/types";

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
          size="sm"
          aria-label={
            active
              ? `Filters, ${count} applied`
              : "Filters, none applied"
          }
          className={cn("h-8 gap-1.5", active && "border-foreground/30")}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {active && (
            <span className="bg-foreground text-background tabular flex size-4 items-center justify-center rounded-full font-mono text-[10px]">
              {count}
            </span>
          )}
          <ChevronDown className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        // Capped so the menu never exceeds a laptop screen; the sections
        // together run to about two dozen rows.
        className="max-h-[min(70vh,34rem)] w-60 overflow-y-auto"
      >
        <DropdownMenuLabel>Outcome</DropdownMenuLabel>
        {OUTCOMES.map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={state.outcome.includes(value)}
            onSelect={keepOpen}
            onCheckedChange={() => toggle("outcome", value)}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  TONE_DOT_CLASS[OUTCOME_TONE[value]],
                )}
              />
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
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  TONE_DOT_CLASS[STATUS_TONE[value]],
                )}
              />
              {statusLabel[value]}
            </span>
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Intent</DropdownMenuLabel>
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
                {CHANNEL_LABELS[value]}
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
              className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
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
