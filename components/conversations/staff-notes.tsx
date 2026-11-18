"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { saveStaffNote } from "@/lib/conversations/actions";

const CONFIRMATION_MS = 2500;
const MAX_LENGTH = 2000;

/**
 * Free-text internal note attached to a conversation.
 *
 * Saves explicitly rather than on blur: an autosaving textarea in a review
 * queue is how half-written notes get committed. The button is disabled until
 * the text actually differs from what is stored, so there is no way to "save"
 * a no-op and wonder whether it worked.
 */
export function StaffNotes({
  conversationId,
  initialNote,
}: {
  conversationId: string;
  initialNote: string | null;
}) {
  const [value, setValue] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const dirty = value !== saved;

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveStaffNote(conversationId, value);
      if (result.ok) {
        setSaved(value);
        setConfirmed(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setConfirmed(false), CONFIRMATION_MS);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="staff-note" className="text-ink-2 text-[13px]">
          Only staff see this. The agent doesn&apos;t read it.
        </Label>
        <span className="tnum text-ink-4 text-xs">
          {value.length}/{MAX_LENGTH}
        </span>
      </div>

      <Textarea
        id="staff-note"
        rows={4}
        maxLength={MAX_LENGTH}
        value={value}
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        placeholder="e.g. Called back at 4 PM, booked with Dr Rao for Friday."
        className="resize-y text-sm"
      />

      {error !== null && (
        <p role="alert" className="text-danger-text text-xs">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" variant={dirty ? "default" : "outline"} onClick={onSave} disabled={!dirty || isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Save note
        </Button>

        {/* aria-live so the confirmation is announced, not just shown. */}
        <span aria-live="polite" className="text-ink-3 text-xs">
          {confirmed && !dirty ? (
            <span className="text-booked-text md-fade flex items-center gap-1">
              <Check className="size-3.5" />
              Note saved
            </span>
          ) : dirty ? (
            "Unsaved changes"
          ) : null}
        </span>
      </div>
    </div>
  );
}
