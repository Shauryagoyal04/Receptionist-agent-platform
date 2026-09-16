"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/google-button";
import { authErrorMessage, isSilentAuthError } from "@/lib/auth/errors";
import { signInWithGoogle, signUpWithEmail } from "@/lib/auth/client-actions";

export function SignUpForm({ allowedDomains }: { allowedDomains: string[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pending = busy || isPending;

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      startTransition(() => {
        router.replace("/analytics");
        router.refresh();
      });
    } catch (caught) {
      if (!isSilentAuthError(caught)) setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    await run(() => signUpWithEmail(name, email, password));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {allowedDomains.length > 0
            ? `Open to staff with an ${allowedDomains
                .map((domain) => `@${domain}`)
                .join(" or ")} address.`
            : "Ask an administrator before creating an account."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            disabled={pending}
            placeholder="Priya Sharma"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            placeholder={
              allowedDomains.length > 0
                ? `you@${allowedDomains[0]}`
                : "you@example.com"
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            disabled={pending}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-muted-foreground text-xs">
            At least 6 characters.
          </p>
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
          Create account
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <GoogleButton
        label="Sign up with Google"
        disabled={pending}
        onClick={() => void run(() => signInWithGoogle("signup"))}
      />

      <p className="text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
