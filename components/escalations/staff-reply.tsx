"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, CircleAlert, Clock, Loader2, Send, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { handBackToAiAction, sendStaffReplyAction } from "@/lib/escalations/actions";
import { cn } from "@/lib/utils";

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

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-danger-text flex items-start gap-1.5 text-[13px]">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/**
 * The reply box for a WhatsApp chat handled by staff: a composer that reads
 * like taking over the chat. Amber marks the human side. The message goes
 * to the agent's outbox and is sent from the clinic's WhatsApp number; its
 * delivery status shows on the message in the transcript.
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
      <div className="bg-sunken text-ink-2 flex items-start gap-3 rounded-xl px-4 py-3 text-sm">
        <Clock className="text-ink-3 mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          <span className="text-ink font-medium">The 24-hour reply window has closed.</span>{" "}
          WhatsApp only allows replies within 24 hours of the patient&apos;s last message. Call the
          patient instead, or wait for them to write again.
        </p>
      </div>
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

  const nearLimit = value.length > MAX_LENGTH * 0.9;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "bg-surface overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-(--dur-quick)",
          "border-human/40 focus-within:border-human focus-within:shadow-[0_0_0_3px_var(--human-soft)]",
        )}
      >
        <div className="bg-human-soft text-human-text flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium">
          <UserRound className="size-4" aria-hidden="true" />
          <Label htmlFor="staff-reply" className="text-human-text text-[13px] font-medium">
            You&apos;re replying on WhatsApp as the clinic
          </Label>
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
          aria-describedby="staff-reply-hint"
          className="min-h-24 resize-y rounded-none border-0 bg-transparent px-3.5 focus-visible:shadow-none hover:border-0"
        />
        <div className="border-line flex items-center justify-between gap-3 border-t px-3.5 py-2">
          <span id="staff-reply-hint" className="text-ink-3 text-xs">
            {windowClosesAt ? `You can reply until ${windowClosesAt}. ` : ""}
            <span className="hidden sm:inline">⌘/Ctrl + Enter to send.</span>
          </span>
          <span className="flex items-center gap-3">
            <span className={cn("tnum text-xs", nearLimit ? "text-danger-text" : "text-ink-4")}>
              {value.length}/{MAX_LENGTH}
            </span>
            <Button size="sm" onClick={onSend} disabled={isPending || value.trim().length === 0}>
              {isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Send
            </Button>
          </span>
        </div>
      </div>
      {error !== null && <ErrorLine>{error}</ErrorLine>}
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
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <Bot className="text-agent" />
        Hand back to AI
      </Button>
    );
  }

  return (
    <div className="bg-agent-soft/60 md-fade flex flex-col gap-2 rounded-[10px] p-3">
      <Label htmlFor="hand-back-note" className="text-ink-2 text-[13px]">
        What was sorted out?
      </Label>
      <Textarea
        id="hand-back-note"
        rows={2}
        maxLength={2000}
        value={note}
        disabled={isPending}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Rescheduled to Friday 4 PM with Dr Rao."
        className="resize-y text-sm"
      />
      <p className="text-ink-3 text-xs">
        Optional. The escalation is resolved and the AI answers the patient&apos;s next message.
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
      {error !== null && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}
