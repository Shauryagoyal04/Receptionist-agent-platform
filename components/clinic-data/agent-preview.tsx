"use client";

import * as React from "react";
import { MessageCircle, Phone } from "lucide-react";

import { cn } from "@/lib/utils";

export type PreviewFact = {
  /** What a patient might ask. */
  question: string;
  /** The agent's answer, or null when the field behind it is empty. */
  answer: string | null;
  /** What the agent says instead, honestly, when it doesn't know. */
  fallback: string;
  /** Field to jump to from the "Add …" link. */
  fieldId: string;
  addLabel: string;
};

type Mode = "whatsapp" | "voice";

const DAY_WORDS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/**
 * Voice reads text aloud, so short forms become words: "Mon–Sat" is
 * "Monday to Saturday", "9 AM" is "9 a.m.", and digit runs in phone numbers
 * are spaced out the way a person would say them.
 */
function spoken(text: string): string {
  return (
    text
      // Phone numbers first, so their hyphens aren't read as "to".
      .replace(/\+?\d[\d\s-]{7,}\d/g, (m) => m.replace(/[\s-]+/g, "").split("").join(" "))
      .replace(/\b(mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b\.?/gi, (m) => DAY_WORDS[m.replace(".", "").toLowerCase()] ?? m)
      // Only ranges ("9–5", "9 AM – 1 PM", "Monday–Saturday"), not hyphenated words.
      .replace(/(\d|\bAM|\bPM|day)\s*[–—-]\s*/gi, "$1 to ")
      .replace(/\bAM\b/gi, "a.m.")
      .replace(/\bPM\b/gi, "p.m.")
  );
}

/**
 * "How the agent will answer": a small chat mock built from the form's
 * current values, so staff see the effect of a field before they save. When
 * a field is empty, the agent's real fallback is shown in grey italic with a
 * link that jumps to the field.
 *
 * Bubbles use the channel colour (WhatsApp green, voice indigo), since that
 * is the channel the patient would be on.
 */
export function AgentPreview({
  greeting,
  facts,
  className,
}: {
  greeting: string;
  facts: PreviewFact[];
  className?: string;
}) {
  const [mode, setMode] = React.useState<Mode>("whatsapp");
  const voice = mode === "voice";
  const say = (text: string) => (voice ? spoken(text) : text);

  function jump(fieldId: string) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  return (
    <section
      aria-labelledby="agent-preview-title"
      className={cn("bg-surface border-line flex flex-col rounded-xl border", className)}
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id="agent-preview-title" className="text-ink text-[17px] leading-6 font-semibold">
            How the agent will answer
          </h2>
          <p className="text-ink-3 mt-0.5 text-[13px]">Updates as you type</p>
        </div>
      </header>

      <div role="group" aria-label="Channel" className="bg-sunken mx-5 mt-4 grid grid-cols-2 rounded-[10px] p-0.5">
        {(
          [
            { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
            { id: "voice", label: "Voice", icon: Phone },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => setMode(option.id)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors duration-(--dur-quick)",
              mode === option.id ? "bg-surface text-ink shadow-[0_1px_2px_rgba(23,38,42,.08)]" : "text-ink-3 hover:text-ink",
            )}
          >
            <option.icon className="size-3.5" aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-2.5 px-5 pt-4 pb-5" aria-live="polite">
        <Bubble from="agent" voice={voice}>
          {say(greeting)}
        </Bubble>
        {facts.map((fact) => (
          <React.Fragment key={fact.question}>
            <Bubble from="patient" voice={voice}>
              {fact.question}
            </Bubble>
            <Bubble from="agent" voice={voice} muted={fact.answer === null}>
              {fact.answer === null ? (
                <>
                  <span className="italic">{say(fact.fallback)}</span>
                  <button
                    type="button"
                    onClick={() => jump(fact.fieldId)}
                    className="text-agent-text mt-1 block text-xs font-medium not-italic underline-offset-2 hover:underline"
                  >
                    {fact.addLabel}
                  </button>
                </>
              ) : (
                say(fact.answer)
              )}
            </Bubble>
          </React.Fragment>
        ))}
      </ol>
    </section>
  );
}

function Bubble({
  from,
  voice,
  muted = false,
  children,
}: {
  from: "agent" | "patient";
  voice: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  const agent = from === "agent";
  return (
    <li className={cn("flex", agent ? "justify-start" : "justify-end")}>
      <span
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-[18px]",
          agent ? "rounded-bl-md" : "rounded-br-md",
          agent && muted && "bg-sunken text-ink-3",
          agent && !muted && (voice ? "bg-voice-soft text-voice-text" : "bg-whatsapp-soft text-whatsapp-text"),
          !agent && "border-line text-ink-2 border bg-surface",
        )}
      >
        <span className="sr-only">{agent ? "Agent: " : "Patient: "}</span>
        {children}
      </span>
    </li>
  );
}
