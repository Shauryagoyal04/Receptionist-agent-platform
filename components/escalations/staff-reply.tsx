"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Clock, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { handBackToAiAction, sendStaffReplyAction } from "@/lib/escalations/actions";

const MAX_LENGTH = 4096;
const POLL_MS = 5000;

/**
 * Re-renders the page every few seconds while staff handle a chat, so new
 * patient messages and delivery ticks show up without a reload. Pauses while
 * the tab is hidden.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

/**
 * The reply box for a WhatsApp chat handled by staff. The message goes to the
 * agent's outbox and is sent from the clinic's WhatsApp number; its delivery
 * status shows on the message in the transcript.
 *
 * Outside WhatsApp's 24-hour window the box is disabled: Meta rejects
 * free-text messages then, and saying so up front beats a failed send.
 */
export function StaffReply({
  conversationId,
  windowOpen,
  windowClosesAt,
}: {
  conversationId: string;
  windowOpen: boolean;
  windowClosesAt: string | null;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!windowOpen) {
    return (
      <p className="text-muted-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
        <Clock className="mt-0.5 size-4 shrink-0" />
        WhatsApp only allows replies within 24 hours of the patient&apos;s last
        message, and that window has closed. Call the patient instead, or wait
        for them to write again.
      </p>
    );
  }

  function onSend() {
    const text = value.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const result = await sendStaffReplyAction(conversationId, text);
      if (result.ok) setValue("");
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="staff-reply">Reply on WhatsApp</Label>
        <span className="text-muted-foreground tabular font-mono text-xs">
          {value.length}/{MAX_LENGTH}
        </span>
      </div>
      <Textarea
        id="staff-reply"
        rows={3}
        maxLength={MAX_LENGTH}
        value={value}
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/Cmd+Enter sends; plain Enter is a new line, as in WhatsApp Web.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="Write to the patient. They'll get it from the clinic's WhatsApp number."
        className="resize-y text-sm"
      />
      {error !== null && (
        <p role="alert" className="text-status-escalated text-xs">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {windowClosesAt ? `You can reply until ${windowClosesAt}.` : null}
        </span>
        <Button size="sm" onClick={onSend} disabled={isPending || value.trim().length === 0}>
          {isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Send
        </Button>
      </div>
    </div>
  );
}

/**
 * Ends staff handling: resolves the chat's escalation and lets the AI answer
 * the patient's next message.
 */
export function HandBackButton({ conversationId }: { conversationId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await handBackToAiAction(conversationId, note);
      if (result.ok) {
        setConfirming(false);
        setNote("");
      } else {
        setError(result.error);
      }
    });
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        <Bot />
        Hand back to AI
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="hand-back-note" className="text-xs">
        Resolution note (optional)
      </Label>
      <Textarea
        id="hand-back-note"
        rows={2}
        maxLength={2000}
        value={note}
        disabled={isPending}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What was sorted out."
        className="resize-y text-sm"
      />
      <p className="text-muted-foreground text-xs">
        The escalation is resolved and the AI answers the patient&apos;s next message.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Bot />}
          Hand back
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-status-escalated text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
