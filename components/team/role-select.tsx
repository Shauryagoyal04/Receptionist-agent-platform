"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { setRoleAction } from "@/lib/team/actions";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "@/lib/types";

/**
 * Role picker for one account. Saves on change (one field, nothing to
 * half-finish) and shows the new role at once; a failed save snaps back and
 * says why.
 */
export function RoleSelect({
  userId,
  role,
  name,
}: {
  userId: string;
  role: UserRole;
  name: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(role);

  function onChange(next: UserRole) {
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setRoleAction(userId, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label={`Role for ${name}`}
          value={optimistic}
          disabled={isPending}
          onChange={(event) => onChange(event.target.value as UserRole)}
          className="w-48"
        >
          {USER_ROLES.map((value) => (
            <option key={value} value={value}>
              {USER_ROLE_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
        {isPending && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
      </div>
      {error !== null && (
        <p role="alert" className="text-status-escalated text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
