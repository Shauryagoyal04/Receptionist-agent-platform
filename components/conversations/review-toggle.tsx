"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CircleCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setReviewedFlag } from "@/lib/conversations/actions";

/**
 * Marks a conversation as triaged.
 *
 * Optimistic: the button flips the moment it is pressed, because a reviewer
 * working through a queue should never wait on a round trip to see that the
 * click registered. If the write fails the state snaps back and says why.
 */
export function ReviewToggle({
  conversationId,
  reviewed,
}: {
  conversationId: string;
  reviewed: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(reviewed);

  function onToggle() {
    setError(null);
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setReviewedFlag(conversationId, next);
      // On failure useOptimistic reverts to the server value on its own once
      // the transition settles; we only need to explain what happened.
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={optimistic ? "secondary" : "outline"}
        aria-pressed={optimistic}
        disabled={isPending}
        onClick={onToggle}
        className={cn(optimistic && "text-status-booked")}
      >
        {isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <CircleCheck className={cn(optimistic && "fill-status-booked/15")} />
        )}
        {optimistic ? "Reviewed" : "Mark reviewed"}
      </Button>
      {error !== null && (
        <p role="alert" className="text-status-escalated text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
