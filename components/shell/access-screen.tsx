import { Clock, Headset, UserX } from "lucide-react";

import { SignOutButton } from "@/components/shell/sign-out-button";

/**
 * What a signed-in person sees when they may not see clinic data yet.
 *
 * `pending`: signed up, waiting for an admin to approve them on the Team page.
 * `missing`: the session points at an account that no longer exists. Shown
 * instead of redirecting to /login, because `proxy.ts` sends anyone with a
 * session cookie straight back here, which would loop.
 */
export function AccessScreen({
  kind,
  email,
}: {
  kind: "pending" | "missing";
  email?: string | null;
}) {
  const Icon = kind === "pending" ? Clock : UserX;
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <Headset className="size-4" />
          </span>
          <span className="text-base font-semibold">Medi Desk AI</span>
        </div>

        <Icon className="text-muted-foreground mb-3 size-6" />
        {kind === "pending" ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              Waiting for approval
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Your account{email ? ` (${email})` : ""} was created. An admin at
              the clinic needs to give you access before you can see anything.
              Ask them to approve you on the Team page, then reload this page.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              Account not found
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              This session belongs to an account that no longer exists. Sign out
              and sign in again.
            </p>
          </>
        )}

        <SignOutButton className="mt-6" />
      </div>
    </main>
  );
}
