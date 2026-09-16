import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  OUTCOME_TONE,
  SENTIMENT_TONE,
  STATUS_TONE,
  TONE_BADGE_CLASS,
  type ConversationStatus,
  type Outcome,
  type Sentiment,
} from "@/lib/types";

/*
 * The one badge used for outcome, status and sentiment.
 *
 * It takes a domain value rather than a color, so a value cannot be rendered
 * in one color on the conversations list and a different one on the detail
 * page or in a chart legend. Adding a new outcome means adding it to the tone
 * map in `lib/types.ts` and nothing else.
 */
type StatusBadgeProps = Omit<React.ComponentProps<typeof Badge>, "variant"> &
  (
    | { kind: "outcome"; value: Outcome }
    | { kind: "status"; value: ConversationStatus }
    | { kind: "sentiment"; value: Sentiment }
  );

export function StatusBadge({
  kind,
  value,
  className,
  ...props
}: StatusBadgeProps) {
  const tone =
    kind === "outcome"
      ? OUTCOME_TONE[value]
      : kind === "status"
        ? STATUS_TONE[value]
        : SENTIMENT_TONE[value];

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", TONE_BADGE_CLASS[tone], className)}
      {...props}
    />
  );
}
