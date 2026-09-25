"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/conversations/search-input";
import { DateRangePicker } from "@/components/conversations/date-range-picker";
import { FiltersMenu } from "@/components/conversations/filters-menu";
import { useFilterNav } from "@/components/conversations/use-filter-nav";
import {
  hasActiveUrlFilters,
  type UrlFilterState,
} from "@/lib/conversations/params";
import type { Channel } from "@/lib/types";

/**
 * Controls for the conversations list.
 *
 * One row: search on the left, then the date range and a single Filters menu
 * holding every facet. Each change is a URL navigation, so the back button
 * walks filter history and any view can be pasted to a colleague.
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
  const { clear } = useFilterNav(state);
  const active = hasActiveUrlFilters(state);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <SearchInput state={state} />

      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker state={state} timeZone={timeZone} />

        <FiltersMenu
          state={state}
          enabledChannels={enabledChannels}
          showChannelUi={showChannelUi}
          handoffEnabled={handoffEnabled}
        />

        {/* Only offered once something is actually filtered, so it does not
            sit there as a dead control on first load. This one also clears
            the search box and the date range, which the menu does not. */}
        {active && (
          <Button variant="ghost" size="sm" className="h-8" onClick={clear}>
            <X />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
