import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/shell/sign-out-button";

export const metadata: Metadata = {
  title: "Analytics",
  description: "How the virtual receptionist performed over time.",
};

export default async function AnalyticsPage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-[1400px] px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Signed in as {user?.displayName ?? user?.email ?? "unknown"} (
            {user?.role}).
          </p>
        </div>
        <SignOutButton />
      </div>
    </main>
  );
}
