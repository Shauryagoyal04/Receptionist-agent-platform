import { redirect } from "next/navigation";
import { CalendarCheck, MessageCircle, Phone } from "lucide-react";

import { BrandMark } from "@/components/shell/brand-mark";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Signed-in users have no business on the sign-in pages. `proxy.ts` already
 * bounces them on a cookie check; this verifies for real, which also covers
 * the case of a stale cookie that no longer resolves to a user.
 *
 * Layout: the form on the left, and on wide screens a calm panel showing
 * what the console is for — a sample of the agent at work — so the first
 * screen says what the product does without a marketing paragraph.
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (user) redirect("/analytics");

  return (
    <div className="bg-app flex min-h-svh flex-1">
      <div className="flex flex-1 flex-col px-4 py-8 sm:px-10">
        <BrandMark size="lg" />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        <p className="text-ink-4 text-xs">For clinic staff. Patient data stays inside your clinic.</p>
      </div>

      <aside
        aria-hidden="true"
        className="bg-agent-soft relative hidden w-[44%] max-w-[640px] flex-col justify-center overflow-hidden px-14 lg:flex"
      >
        <div
          className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--surface), transparent)", opacity: 0.6 }}
        />
        <div className="relative">
          <p className="text-agent-text text-[28px] leading-[34px] font-semibold">
            Your front desk, answering around the clock.
          </p>
          <p className="text-ink-2 mt-3 max-w-md text-[15px] leading-[22px]">
            See every chat and call the agent handled, step in when a patient asks for a person, and
            keep what it tells patients up to date.
          </p>

          <div className="mt-10 flex max-w-sm flex-col gap-3">
            <div className="bg-surface border-line flex items-start gap-3 rounded-xl border p-3.5">
              <span className="bg-whatsapp-soft text-whatsapp flex size-8 shrink-0 items-center justify-center rounded-lg">
                <MessageCircle className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 text-[13px] leading-[18px]">
                <p className="text-ink font-medium">Can I see Dr Mehta on Saturday?</p>
                <p className="text-ink-3 mt-0.5">
                  Dr Mehta has 10:30 AM or 12:00 PM free. Shall I book one?
                </p>
              </div>
            </div>
            <div className="bg-surface border-line ml-8 flex items-center gap-3 rounded-xl border p-3.5">
              <span className="bg-booked-soft text-booked flex size-8 shrink-0 items-center justify-center rounded-lg">
                <CalendarCheck className="size-4" strokeWidth={1.75} />
              </span>
              <p className="text-ink text-[13px] font-medium">Booked · Sat 10:30 AM with Dr Mehta</p>
            </div>
            <div className="bg-surface border-line flex items-center gap-3 rounded-xl border p-3.5">
              <span className="bg-voice-soft text-voice flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Phone className="size-4" strokeWidth={1.75} />
              </span>
              <p className="text-ink-2 text-[13px]">
                <span className="text-ink font-medium">Voice call</span> · answered a question about
                fees
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
