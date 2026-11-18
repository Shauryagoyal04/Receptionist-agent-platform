import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getAccount } from "@/lib/auth/session";
import { countPendingUsers } from "@/lib/data/users";
import { AccessScreen } from "@/components/shell/access-screen";
import { listCustomPagesForNav } from "@/lib/data/definitions";
import { countOpenEscalations } from "@/lib/data/escalations";
import { getLatestConversationByChannel } from "@/lib/data/conversations";
import { getServerEnv } from "@/lib/env";
import { AgentStatus } from "@/components/shell/agent-status";
import { BrandMark } from "@/components/shell/brand-mark";
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
  const user = await getAccount();
  if (!user) {
    // A session whose account is gone: /login would bounce straight back.
    if (await auth()) return <AccessScreen kind="missing" />;
    redirect("/login");
  }
  // Signed up but not approved: no nav, no data.
  if (user.role === "pending") return <AccessScreen kind="pending" email={user.email} />;

  // The nav lists the clinic's custom pages. A failure here must not take
  // down every page (conversations don't depend on it), so it degrades to
  // the fixed items and the page itself reports any real database problem.
  const isAdmin = user.role === "admin";
  const { capabilities } = getServerEnv();
  const [customPages, openEscalations, pendingUsers, latestByChannel] = await Promise.all([
    // Staff never see custom pages, so don't load them.
    isAdmin
      ? listCustomPagesForNav(user.clinicId).catch((error: unknown) => {
          console.error("[layout] couldn't load custom pages for nav", error);
          return [];
        })
      : Promise.resolve([]),
    // A badge is not worth failing the page for.
    countOpenEscalations(user.clinicId).catch((error: unknown) => {
      console.error("[layout] couldn't count open escalations", error);
      return 0;
    }),
    isAdmin
      ? countPendingUsers(user.clinicId).catch((error: unknown) => {
          console.error("[layout] couldn't count pending accounts", error);
          return 0;
        })
      : Promise.resolve(0),
    // The status falls back to "waiting for the first chat" rather than
    // failing the page.
    getLatestConversationByChannel(user.clinicId).catch((error: unknown) => {
      console.error("[layout] couldn't read the latest conversations", error);
      return null;
    }),
  ]);

  return (
    /*
     * `flex-1`, not `min-h-svh`. The body is already `flex min-h-full
     * flex-col`, so forcing a second full viewport height here stacks two
     * full-height boxes and leaves the page scrollable past its content.
     */
    <div className="flex-1">
      {/*
        Keyboard users would otherwise tab through the whole rail on every
        page load before reaching the table they came for.
      */}
      <a
        href="#main-content"
        className="bg-background focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border focus:px-3 focus:py-2 focus:text-sm focus:ring-2"
      >
        Skip to content
      </a>

      {/* Desktop: a fixed 248px rail. Hidden below lg, where the top bar
          carries the same destinations as tabs. */}
      <aside className="bg-surface border-line fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/analytics" className="rounded-[10px]">
            <BrandMark />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav
            customPages={customPages}
            isAdmin={isAdmin}
            openEscalations={openEscalations}
            pendingUsers={pendingUsers}
          />
        </div>

        <div className="border-line flex flex-col gap-2 border-t p-3">
          <AgentStatus
            openEscalations={openEscalations}
            latestByChannel={latestByChannel}
            enabledChannels={capabilities.enabledChannels}
          />
          <UserMenu
            displayName={user.displayName}
            email={user.email}
            photoURL={user.photoURL}
            role={user.role}
          />
        </div>
      </aside>

      {/* Mobile: a sticky top bar. */}
      <header className="bg-surface/95 supports-[backdrop-filter]:bg-surface/80 border-line sticky top-0 z-30 border-b backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/analytics" className="rounded-[10px]">
            <BrandMark />
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
        <MobileNav
          customPages={customPages}
          isAdmin={isAdmin}
          openEscalations={openEscalations}
          pendingUsers={pendingUsers}
        />
      </header>

      <div id="main-content" className="lg:pl-[248px]">
        {children}
      </div>
    </div>
  );
}
