import * as React from "react";

import { cn } from "@/lib/utils";
import {
  OUTCOME_MEANING,
  SENTIMENT_MEANING,
  STATUS_MEANING,
  meaningVar,
  type ConversationStatus,
  type Meaning,
  type Outcome,
  type Sentiment,
} from "@/lib/types";

/*
 * The one badge used for outcome, status and sentiment.
 *
 * It takes a domain value rather than a color, so a value cannot be rendered
 * in one color on the conversations list and a different one on the detail
 * page or in a chart legend. Outcomes use the fixed outcome colours from the
 * design tokens; a booking is the same green everywhere.
 */
type StatusBadgeProps = React.ComponentProps<"span"> &
  (
    | { kind: "outcome"; value: Outcome }
    | { kind: "status"; value: ConversationStatus }
    | { kind: "sentiment"; value: Sentiment }
  );

export function badgeMeaning(
  kind: StatusBadgeProps["kind"],
  value: string,
): Meaning {
  if (kind === "outcome") return OUTCOME_MEANING[value as Outcome];
  if (kind === "status") return STATUS_MEANING[value as ConversationStatus];
  return SENTIMENT_MEANING[value as Sentiment];
}

export function StatusBadge({ kind, value, className, children, style, ...props }: StatusBadgeProps) {
  const meaning = badgeMeaning(kind, value);
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{ backgroundColor: meaningVar(meaning, "soft"), color: meaningVar(meaning, "text"), ...style }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: meaningVar(meaning) }}
      />
      {children}
    </span>
  );
}
