"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * A multi-select facet as a dropdown.
 *
 * The trigger carries the count of what is selected, so the filter bar stays
 * one compact row while still telling you at a glance that something is
 * filtering the table — which is the one thing chips did better and the
 * reason the count is not optional.
 */
export function FilterDropdown<T extends string>({
  legend,
  values,
  selected,
  labelOf,
  dotOf,
  onToggle,
  onClear,
}: {
  legend: string;
  values: readonly T[];
  selected: readonly T[];
  labelOf: (value: T) => string;
  dotOf?: (value: T) => string;
  onToggle: (value: T) => void;
  onClear: () => void;
}) {
  const count = selected.length;
  const active = count > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          // `aria-label` spells out the selection for screen readers, which
          // otherwise hear only "Outcome 2".
          aria-label={
            active
              ? `${legend}: ${selected.map(labelOf).join(", ")}`
              : `${legend}: no filter`
          }
          className={cn("h-8 gap-1.5", active && "border-foreground/30")}
        >
          {legend}
          {active && (
            <span className="bg-foreground text-background tabular flex size-4 items-center justify-center rounded-full font-mono text-[10px]">
              {count}
            </span>
          )}
          <ChevronDown className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{legend}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {values.map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={selected.includes(value)}
            // Without this the menu closes on every tick, which makes
            // selecting three outcomes three separate round trips.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggle(value)}
          >
            <span className="flex items-center gap-2">
              {dotOf && (
                <span className={cn("size-2 shrink-0 rounded-full", dotOf(value))} />
              )}
              {labelOf(value)}
            </span>
          </DropdownMenuCheckboxItem>
        ))}

        {active && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground w-full px-2 py-1.5 text-left text-sm"
            >
              Clear {legend.toLowerCase()}
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
