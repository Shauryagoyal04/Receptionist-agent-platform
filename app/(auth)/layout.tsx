import { redirect } from "next/navigation";
import { Headset } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";

/**
 * Signed-in users have no business on the sign-in pages. `proxy.ts` already
 * bounces them on a cookie check; this verifies for real, which also covers
 * the case of a stale cookie that no longer resolves to a user.
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (user) redirect("/analytics");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <Headset className="size-4" />
          </span>
          <span className="text-base font-semibold">Reception Console</span>
        </div>
        {children}
      </div>
    </div>
  );
}
