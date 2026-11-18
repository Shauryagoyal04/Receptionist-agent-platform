"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/google-button";
import { authErrorMessage } from "@/lib/auth/errors";

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Google sign-in redirects rather than returning a result, so a failure
  // arrives as ?error= on this page. Without this the user would be bounced
  // back to a blank form with no explanation.
  const redirectedError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    redirectedError ? authErrorMessage(redirectedError) : null,
  );
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  // `next` comes from proxy.ts when it bounces an unauthenticated request.
  // Only accept an in-app path so the parameter cannot be used to redirect
  // someone to another origin after they sign in.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/analytics";

  const pending = busy || isPending;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setBusy(true);

    try {
      // `redirect: false` so a bad password re-renders this form with a
      // message instead of bouncing to Auth.js's own error page.
      const result = await signIn("credentials", {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        redirect: false,
      });

      if (result?.error) {
        setError(authErrorMessage(result.error));
        return;
      }

      startTransition(() => {
        router.replace(next);
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
        <h1 className="text-ink text-[28px] leading-[34px] font-semibold">Sign in</h1>
        <p className="text-ink-3 mt-1.5 text-[15px] leading-[22px]">
          Welcome back. See what the agent handled today.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
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
            placeholder="you@hospital.example"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-ink-2 text-sm font-medium">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="h-11"
          />
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
          Sign in
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
            label="Continue with Google"
            disabled={pending}
            onClick={() => {
              setBusy(true);
              void signIn("google", { redirectTo: next });
            }}
          />
        </>
      )}

      <p className="text-ink-3 text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-agent-text font-medium underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
