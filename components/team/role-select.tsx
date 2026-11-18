"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CircleAlert, Loader2, ShieldCheck, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { setRoleAction } from "@/lib/team/actions";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "@/lib/types";

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-danger-text flex items-start gap-1.5 text-[13px]">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

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
          className="w-40 [&_select]:h-9"
        >
          {USER_ROLES.map((value) => (
            <option key={value} value={value}>
              {value === "pending" ? "No access" : USER_ROLE_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
        {isPending && <Loader2 className="text-ink-3 size-4 animate-spin" aria-label="Saving" />}
      </div>
      {error !== null && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}

/**
 * One-click approval for someone waiting: the common answer is "staff", so
 * it is the primary button; admin is there but quieter. Uses the same
 * action as the role picker.
 */
export function ApproveButtons({ userId, name }: { userId: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [choice, setChoice] = useState<UserRole | null>(null);

  function approve(next: UserRole) {
    setError(null);
    setChoice(next);
    startTransition(async () => {
      const result = await setRoleAction(userId, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => approve("admin")}
          aria-label={`Approve ${name} as admin`}
        >
          {isPending && choice === "admin" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Make admin
        </Button>
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => approve("staff")}
          aria-label={`Approve ${name} as staff`}
        >
          {isPending && choice === "staff" ? <Loader2 className="animate-spin" /> : <UserCheck />}
          Approve as staff
        </Button>
      </div>
      {error !== null && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}
