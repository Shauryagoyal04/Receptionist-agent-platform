"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label, control, hint and error for one form field. The error is tied to
 * the control by id so screen readers announce it with the field.
 */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-muted-foreground text-xs font-normal">required</span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-status-escalated text-xs">
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
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Submit row with a pending spinner, an inline error and a saved tick. */
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
        <p role="alert" className="text-status-escalated text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {label}
        </Button>
        {children}
        <span aria-live="polite" className="text-xs">
          {saved && !pending && (
            <span className="text-status-booked flex items-center gap-1">
              <Check className="size-3.5" />
              Saved
            </span>
          )}
        </span>
      </div>
    </div>
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
        "focus-visible:ring-ring/50 h-7 rounded-md border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 disabled:opacity-50",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-muted text-foreground",
        muted && !pressed && "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
