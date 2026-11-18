"use client";

import * as React from "react";
import { Check, CircleAlert, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label, control, hint and error for one form field. The error is tied to
 * the control by id so screen readers announce it with the field.
 *
 * Required fields say "Required" after the label rather than using an
 * asterisk; optional fields aren't marked. `agentReads` adds a small petrol
 * tag so staff can see which facts the agent will say to patients.
 */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  agentReads,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  agentReads?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-h-5 items-center gap-2">
        <Label htmlFor={id} className="text-ink text-sm font-medium">
          {label}
        </Label>
        {required && <span className="text-ink-3 text-xs">Required</span>}
        {agentReads && (
          <span className="bg-agent-soft text-agent-text ml-auto inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium">
            <Sparkles className="size-3" aria-hidden="true" />
            Agent reads this
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-ink-3 text-[13px] leading-[18px]">{hint}</p>}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-danger-text flex items-start gap-1.5 text-[13px] leading-[18px]"
        >
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Section heading inside a form card. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-ink text-[17px] leading-6 font-semibold">{title}</h2>
        {description && (
          <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * A form section as its own card, with an anchor id so the section nav can
 * scroll to it. `scroll-mt` keeps the heading clear of the mobile top bar.
 */
export function FormCard({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="bg-surface border-line scroll-mt-24 rounded-xl border p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-ink text-[17px] leading-6 font-semibold">
            {title}
          </h2>
          {description && (
            <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">{description}</p>
          )}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Inline submit row with a pending spinner, an inline error and a saved tick.
 * Kept for the settings forms; the record forms use `StickySaveBar`.
 */
export function SaveBar({
  pending,
  error,
  saved,
  label = "Save",
  children,
}: {
  pending: boolean;
  error: string | null;
  saved?: boolean;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-danger-text flex items-start gap-1.5 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {label}
        </Button>
        {children}
        <span aria-live="polite" className="text-[13px]">
          {saved && !pending && (
            <span className="text-booked-text md-fade flex items-center gap-1">
              <Check className="size-3.5" />
              Saved
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * The save bar that slides up from the bottom when there are unsaved
 * changes: "3 unsaved changes", Discard, and a button that says what it
 * saves. Rendered inside the <form>, so its submit button submits the form.
 *
 * `alwaysShown` is for create forms, where nothing exists until it's saved.
 * The button shows a spinner while saving, then a tick for 900ms.
 */
export function StickySaveBar({
  dirtyCount,
  pending,
  justSaved,
  error,
  label,
  onDiscard,
  alwaysShown = false,
  idleText,
}: {
  dirtyCount: number;
  pending: boolean;
  justSaved: boolean;
  error: string | null;
  label: string;
  onDiscard?: () => void;
  alwaysShown?: boolean;
  /** Shown instead of the change count on create forms. */
  idleText?: string;
}) {
  const visible = alwaysShown || dirtyCount > 0 || pending || justSaved || Boolean(error);

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 px-4 pb-4 transition-[transform,opacity] duration-(--dur-base) ease-(--ease-out) sm:px-8 lg:left-[248px]",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <div className="bg-surface border-line mx-auto flex max-w-[1216px] flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-(--shadow-pop) lg:mx-0">
        <p aria-live="polite" className="min-w-0 flex-1 text-sm">
          {error ? (
            <span role="alert" className="text-danger-text flex items-start gap-1.5">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </span>
          ) : justSaved ? (
            <span className="text-booked-text flex items-center gap-1.5">
              <Check className="size-4" aria-hidden="true" />
              All changes saved
            </span>
          ) : dirtyCount > 0 ? (
            <span className="text-ink-2">
              <span className="bg-human mr-2 inline-block size-2 rounded-full align-middle" aria-hidden="true" />
              <span className="tnum">{dirtyCount}</span> unsaved{" "}
              {dirtyCount === 1 ? "change" : "changes"}
            </span>
          ) : (
            <span className="text-ink-3">{idleText ?? "No changes"}</span>
          )}
        </p>
        {onDiscard && dirtyCount > 0 && !pending && (
          <Button type="button" variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
        )}
        <Button type="submit" disabled={pending || (!alwaysShown && dirtyCount === 0)} className="min-w-36">
          {pending ? (
            <Loader2 className="animate-spin" aria-label="Saving" />
          ) : justSaved ? (
            <Check aria-label="Saved" />
          ) : (
            label
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * How many entries of a flat snapshot differ from the saved baseline. The
 * baseline moves to the current values after a successful save.
 */
export function useDirty(snapshot: Record<string, unknown>) {
  const [baseline, setBaseline] = React.useState(snapshot);
  const count = Object.keys({ ...baseline, ...snapshot }).filter(
    (key) => JSON.stringify(baseline[key] ?? null) !== JSON.stringify(snapshot[key] ?? null),
  ).length;
  return { count, baseline, markSaved: () => setBaseline(snapshot) };
}

/** Asks before the tab closes or reloads with unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

/** A brief "saved" state for the save button's tick. */
export function useJustSaved(ms = 900) {
  const [justSaved, setJustSaved] = React.useState(false);
  React.useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), ms);
    return () => window.clearTimeout(timer);
  }, [justSaved, ms]);
  return { justSaved, flash: () => setJustSaved(true) };
}

export type NavSection = { id: string; label: string; filled: number; total: number };

/**
 * Sticky list of a long form's sections, each with a filled/empty dot and a
 * "filled/total" count, plus overall completeness in petrol. Collapses into
 * a horizontal strip on narrow screens.
 */
export function SectionNav({ sections, className }: { sections: NavSection[]; className?: string }) {
  const filled = sections.reduce((sum, s) => sum + s.filled, 0);
  const total = sections.reduce((sum, s) => sum + s.total, 0);
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  return (
    <nav aria-label="Form sections" className={cn("flex flex-col gap-4", className)}>
      <ol className="flex gap-1 overflow-x-auto xl:flex-col">
        {sections.map((section) => {
          const complete = section.total > 0 && section.filled === section.total;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                className="hover:bg-sunken text-ink-2 hover:text-ink flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-sm transition-colors duration-(--dur-quick)"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    complete ? "bg-agent" : section.filled > 0 ? "bg-agent/40" : "shadow-[inset_0_0_0_1.5px_var(--ink-4)]",
                  )}
                />
                <span className="truncate">{section.label}</span>
                <span className="tnum text-ink-3 ml-auto pl-2 text-xs">
                  {section.filled}/{section.total}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {total > 0 && (
        <div className="hidden px-2.5 xl:block">
          <p className="text-ink-3 flex justify-between text-xs">
            <span>Profile complete</span>
            <span className="tnum text-ink-2 font-medium">{pct}%</span>
          </p>
          <span className="bg-sunken mt-1.5 block h-1.5 overflow-hidden rounded-full">
            <span
              className="bg-agent block h-full rounded-full transition-[width] duration-(--dur-slow) ease-(--ease-out)"
              style={{ width: `${pct}%` }}
            />
          </span>
        </div>
      )}
    </nav>
  );
}

/** Pressable chip used for weekdays and multiple-choice options. */
export function ToggleChip({
  pressed,
  onPressedChange,
  children,
  disabled,
  muted,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-(--dur-quick) disabled:opacity-50",
        pressed
          ? "border-transparent bg-agent-soft text-agent-text"
          : "border-line-strong bg-surface text-ink-2 hover:border-ink-4 hover:text-ink",
        muted && !pressed && "text-ink-4",
      )}
    >
      {pressed && <Check className="size-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}
