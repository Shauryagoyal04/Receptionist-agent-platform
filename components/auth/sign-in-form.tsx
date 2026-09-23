"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

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
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Review what the virtual receptionist handled today.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            placeholder="you@hospital.example"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
          />
        </div>

        {error !== null && (
          <p
            role="alert"
            aria-live="polite"
            className="text-status-escalated bg-status-escalated-tint rounded-md px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <span className="bg-border h-px flex-1" />
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

      <p className="text-muted-foreground text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-4">
          Create one
        </Link>
      </p>
    </div>
  );
}
