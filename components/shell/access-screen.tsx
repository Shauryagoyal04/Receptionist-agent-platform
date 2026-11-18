import { Clock, UserX } from "lucide-react";

import { BrandMark } from "@/components/shell/brand-mark";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { cn } from "@/lib/utils";

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
  const pending = kind === "pending";
  const Icon = pending ? Clock : UserX;
  return (
    <main className="bg-app flex min-h-svh flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <BrandMark size="lg" className="mb-8" />

        <div className="bg-surface border-line rounded-2xl border p-6 sm:p-8">
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-[10px]",
              pending ? "bg-agent-soft text-agent" : "bg-none-soft text-none-text",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>

          {pending ? (
            <>
              <h1 className="text-ink mt-5 text-2xl leading-8 font-semibold">Almost there</h1>
              <p className="text-ink-2 mt-2 text-[15px] leading-[22px]">
                Your account{email ? <> (<span className="text-ink font-medium">{email}</span>)</> : ""}{" "}
                is set up. An admin at the clinic needs to approve it on the Team page before you can
                see anything.
              </p>
              <p className="text-ink-3 mt-3 text-[13px]">
                Ask them to approve you, then reload this page.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-ink mt-5 text-2xl leading-8 font-semibold">Account not found</h1>
              <p className="text-ink-2 mt-2 text-[15px] leading-[22px]">
                This session belongs to an account that no longer exists. Sign out, then sign in
                again or create a new account.
              </p>
            </>
          )}

          <SignOutButton className="mt-6" />
        </div>
      </div>
    </main>
  );
}
