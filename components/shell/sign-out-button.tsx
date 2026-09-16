"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOutEverywhere } from "@/lib/auth/client-actions";

export function SignOutButton({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onClick() {
    setBusy(true);
    try {
      await signOutEverywhere();
      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={busy || isPending}
      onClick={() => void onClick()}
    >
      <LogOut />
      Sign out
    </Button>
  );
}
