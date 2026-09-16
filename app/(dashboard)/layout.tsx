import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

/**
 * The authentication boundary for everything under /(dashboard).
 *
 * `proxy.ts` redirects on a missing cookie, but it does not verify one, so
 * this is the check that actually decides whether a request may see clinic
 * data. Server Actions defined in child routes must repeat it — Next.js runs
 * them as POSTs to the page route, outside this layout's render.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
