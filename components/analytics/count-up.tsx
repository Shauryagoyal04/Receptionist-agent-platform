"use client";

import * as React from "react";

import { formatMetric, type MetricKind } from "@/components/analytics/format";

const DURATION_FIRST = 600;
const DURATION_CHANGE = 400;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * A number that counts up from 0 when the page's data first arrives, and
 * tweens from the old value to the new one when the date range changes.
 *
 * The server renders the final value, so the figure is correct before
 * hydration, without JavaScript and for screen readers (which only ever see
 * the final value through `aria-label`). Tabular figures keep the width from
 * jumping while it counts.
 */
export function CountUp({
  value,
  kind,
  className,
}: {
  value: number;
  kind: MetricKind;
  className?: string;
}) {
  const final = formatMetric(kind, value);
  const [shown, setShown] = React.useState(final);
  const previous = React.useRef<number | null>(null);

  React.useEffect(() => {
    const from = previous.current ?? 0;
    previous.current = value;
    if (prefersReducedMotion() || from === value) {
      setShown(formatMetric(kind, value));
      return;
    }

    const duration = from === 0 ? DURATION_FIRST : DURATION_CHANGE;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const current = from + (value - from) * easeOut(t);
      // Counts tick through whole numbers; everything else tweens smoothly.
      setShown(formatMetric(kind, kind === "count" ? Math.round(current) : current));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, kind]);

  return (
    <span className={className} aria-label={final}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
