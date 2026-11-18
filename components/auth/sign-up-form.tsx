"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/google-button";
import { authErrorMessage } from "@/lib/auth/errors";
import { registerUser } from "@/lib/auth/register";

export function SignUpForm({
  allowedDomains,
  googleEnabled,
}: {
  allowedDomains: string[];
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pending = busy || isPending;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setError(null);
    setBusy(true);

    try {
      const created = await registerUser({
        name: String(form.get("name") ?? "").trim(),
        email,
        password,
      });

      if (!created.ok) {
        setError(created.error);
        return;
      }

      // Registration does not establish a session, so sign in with the same
      // credentials immediately rather than making someone type them twice.
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          "Your account was created, but signing in failed. Try signing in.",
        );
        return;
      }

      startTransition(() => {
        router.replace("/analytics");
        router.refresh();
      });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-ink text-[28px] leading-[34px] font-semibold">
          Create an account
        </h1>
        <p className="text-ink-3 mt-1.5 text-[15px] leading-[22px]">
          {allowedDomains.length > 0
            ? `Open to staff with an ${allowedDomains
                .map((domain) => `@${domain}`)
                .join(" or ")} address.`
            : "An admin at the clinic approves new accounts before they can see anything."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name" className="text-ink-2 text-sm font-medium">Full name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            disabled={pending}
            className="h-11"
            placeholder="Priya Sharma"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-ink-2 text-sm font-medium">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            className="h-11"
            placeholder={
              allowedDomains.length > 0
                ? `you@${allowedDomains[0]}`
                : "you@example.com"
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-ink-2 text-sm font-medium">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
            className="h-11"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-ink-3 text-[13px]">
            At least 8 characters.
          </p>
        </div>

        {error !== null && (
          <p
            role="alert"
            aria-live="polite"
            className="bg-danger-soft text-danger-text flex items-start gap-2 rounded-[10px] px-3.5 py-2.5 text-sm"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="mt-1 h-11 w-full">
          {pending && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3">
            <span className="bg-line h-px flex-1" />
            <span className="text-ink-3 text-[13px]">or</span>
            <span className="bg-line h-px flex-1" />
          </div>

          <GoogleButton
            label="Sign up with Google"
            disabled={pending}
            onClick={() => {
              setBusy(true);
              void signIn("google", { redirectTo: "/analytics" });
            }}
          />
        </>
      )}

      <p className="text-ink-3 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-agent-text font-medium underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
