"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import {
  setDoctorActiveFlag,
  setRecordActiveFlag,
} from "@/lib/clinic-data/actions";

export type ActiveTarget =
  | { kind: "doctor"; id: string }
  | { kind: "record"; entityType: string; id: string };

/**
 * Activate / deactivate a doctor or custom-page row in place. Rows are never
 * deleted: inactive ones are hidden from the agent and greyed in the console.
 * Optimistic, like the review toggle, and snaps back with a toast on failure.
 */
export function ActiveToggle({
  target,
  isActive,
  label,
}: {
  target: ActiveTarget;
  isActive: boolean;
  label: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(isActive);
  const [isPending, startTransition] = useTransition();

  function onChange(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);
      const result =
        target.kind === "doctor"
          ? await setDoctorActiveFlag(target.id, next)
          : await setRecordActiveFlag(target.entityType, target.id, next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Switch
      checked={optimistic}
      disabled={isPending}
      onCheckedChange={onChange}
      aria-label={`${label}: ${optimistic ? "active" : "inactive"}`}
    />
  );
}
