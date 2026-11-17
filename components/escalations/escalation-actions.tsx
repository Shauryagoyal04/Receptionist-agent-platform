"use client";

import { useState, useTransition } from "react";
import { Check, Hand, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  claimEscalationAction,
  resolveEscalationAction,
} from "@/lib/escalations/actions";
import type { Channel, EscalationStatus } from "@/lib/types";

/**
 * Claim and resolve buttons for one escalation.
 *
 * Resolving opens a short optional note first ("called back, booked for
 * Monday"), because the next person on the desk reads it. For a WhatsApp
 * chat, resolving also hands the chat back to the AI, and the button says so.
 */
export function EscalationActions({
  escalationId,
  status,
  conversationDocId,
  channel,
  resolveLabel,
  claimOnly = false,
}: {
  escalationId: string;
  status: Exclude<EscalationStatus, "resolved">;
  conversationDocId: string | null;
  channel: Channel;
  resolveLabel?: string;
  /** Only the Claim button (the conversation page has its own hand-back). */
  claimOnly?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const label =
    resolveLabel ?? (channel === "whatsapp" ? "Resolve and hand back to AI" : "Mark resolved");

  function onClaim() {
    setError(null);
    startTransition(async () => {
      const result = await claimEscalationAction(escalationId);
      if (!result.ok) setError(result.error);
    });
  }

  function onResolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveEscalationAction(
        escalationId,
        note,
        conversationDocId ?? undefined,
      );
      if (result.ok) {
        setResolving(false);
        setNote("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {status === "open" && !resolving && (
        <Button size="sm" variant="outline" onClick={onClaim} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Hand />}
          Claim
        </Button>
      )}

      {claimOnly ? null : resolving ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`resolve-note-${escalationId}`} className="text-xs">
            Note (optional)
          </Label>
          <Textarea
            id={`resolve-note-${escalationId}`}
            rows={3}
            maxLength={2000}
            value={note}
            disabled={isPending}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What happened, for whoever reads this next."
            className="resize-y text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onResolve} disabled={isPending} className="flex-1">
              {isPending ? <Loader2 className="animate-spin" /> : <Check />}
              Resolve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setResolving(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setResolving(true)}
          disabled={isPending}
        >
          <Check />
          {label}
        </Button>
      )}

      {error !== null && (
        <p role="alert" className="text-status-escalated text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
