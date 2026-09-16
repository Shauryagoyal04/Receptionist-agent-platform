import Link from "next/link";
import { redirect } from "next/navigation";
import { Headset } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { MobileNav, SidebarNav } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";

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

  return (
    <div className="min-h-svh">
      {/* Desktop: a fixed 240px rail. Hidden below lg, where the top bar
          carries the same destinations as tabs. */}
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r lg:flex">
        <div className="flex h-14 items-center gap-2.5 px-5">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <Headset className="size-4" />
          </span>
          <span className="text-sm font-semibold">Reception Console</span>
        </div>

        <div className="flex-1 py-2">
          <SidebarNav />
        </div>

        <div className="border-sidebar-border border-t p-2">
          <UserMenu
            displayName={user.displayName}
            email={user.email}
            photoURL={user.photoURL}
            role={user.role}
          />
        </div>
      </aside>

      {/* Mobile: a sticky top bar. */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/analytics" className="flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <Headset className="size-4" />
            </span>
            <span className="text-sm font-semibold">Reception Console</span>
          </Link>
          <div className="w-44">
            <UserMenu
              displayName={user.displayName}
              email={user.email}
              photoURL={user.photoURL}
              role={user.role}
              align="end"
            />
          </div>
        </div>
        <MobileNav />
      </header>

      <div className="lg:pl-60">{children}</div>
    </div>
  );
}
