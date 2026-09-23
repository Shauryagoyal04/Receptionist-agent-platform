"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

import { buildQueryString, type UrlFilterState } from "@/lib/conversations/params";

/**
 * One place where every filter control writes back to the URL.
 *
 * Two rules are enforced here rather than in each control:
 *  - changing a filter always drops the cursor, because a cursor points into
 *    a differently-filtered result set and reusing it silently skips rows;
 *  - navigation uses push, not replace, so the back button steps through
 *    filter states as §7 requires.
 */
export function useFilterNav(state: UrlFilterState) {
  const router = useRouter();
  const pathname = usePathname();

  const apply = useCallback(
    (patch: Partial<UrlFilterState>) => {
      const next = { ...state, ...patch };
      router.push(`${pathname}${buildQueryString(next)}`, { scroll: false });
    },
    [pathname, router, state],
  );

  /** Adds or removes one value from a multi-select facet. */
  const toggle = useCallback(
    <K extends "status" | "outcome" | "intent" | "channel">(
      key: K,
      value: UrlFilterState[K][number],
    ) => {
      const current = state[key] as string[];
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      apply({ [key]: next } as unknown as Partial<UrlFilterState>);
    },
    [apply, state],
  );

  const clear = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  return { apply, toggle, clear };
}
