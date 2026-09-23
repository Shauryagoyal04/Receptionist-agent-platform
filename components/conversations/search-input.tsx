"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useFilterNav } from "@/components/conversations/use-filter-nav";
import type { UrlFilterState } from "@/lib/conversations/params";

const DEBOUNCE_MS = 300;

/**
 * Search box for the conversations list.
 *
 * Debounced by 300ms so a typed query is one navigation rather than one per
 * keystroke. The input holds its own value while typing and re-syncs when the
 * URL changes from elsewhere (a cleared filter, a back button press), which
 * keeps the field from fighting the router.
 */
export function SearchInput({ state }: { state: UrlFilterState }) {
  const { apply } = useFilterNav(state);
  const [value, setValue] = useState(state.q);
  const committed = useRef(state.q);

  useEffect(() => {
    if (state.q !== committed.current) {
      committed.current = state.q;
      setValue(state.q);
    }
  }, [state.q]);

  useEffect(() => {
    if (value === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = value;
      apply({ q: value });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, apply]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Name, doctor or phone digits"
        aria-label="Search conversations by patient name, doctor or phone digits"
        aria-describedby="search-hint"
        className="pr-8 pl-8"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
        >
          <X className="size-4" />
        </button>
      )}
      <p id="search-hint" className="sr-only">
        Matches whole words and phone digits. Partial spellings do not match.
      </p>
    </div>
  );
}
