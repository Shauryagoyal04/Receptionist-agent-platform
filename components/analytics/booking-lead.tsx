"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus } from "lucide-react";

import { CountUp } from "@/components/analytics/count-up";
import { TrendChip } from "@/components/analytics/trend-chip";
import { formatMetric } from "@/components/analytics/format";
import type { BookingFunnel } from "@/lib/analytics/aggregate";

const SIZE = 120;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * The lead element on Analytics: did patients who wanted an appointment get
 * one? A ring with the rate, the same fact as a plain sentence, and a funnel
 * that shows where attempts drop off — the most actionable thing on the page.
 */
export function BookingLead({
  rate,
  funnel,
  delta,
  bookedHref,
}: {
  rate: number;
  funnel: BookingFunnel;
  delta: number | null;
  bookedHref: string;
}) {
  const empty = funnel.wanted === 0;
  // A rate from one attempt is "1 of 1", not "100%".
  const tinySample = funnel.wanted === 1;

  return (
    <section
      aria-labelledby="lead-title"
      className="bg-surface border-line relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-6"
    >
      {/* The page's one decorative flourish: a faint booked wash, top right. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full"
        style={{
          background: "radial-gradient(closest-side, var(--booked-soft), transparent)",
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h2 id="lead-title" className="text-ink text-[17px] leading-6 font-semibold">
            Booking completion
          </h2>
          <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">
            Patients who wanted an appointment and got one
          </p>
        </div>
        {!empty && (
          <Link
            href={bookedHref}
            className="group/link text-agent-text hover:text-agent flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium transition-colors duration-(--dur-quick)"
          >
            Booked chats
            <ArrowRight className="size-3.5 transition-transform duration-(--dur-quick) group-hover/link:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="relative mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
        <Ring fraction={empty ? 0 : rate}>
          {empty ? (
            <span className="text-ink-4 text-[32px] leading-none font-semibold">0</span>
          ) : tinySample ? (
            <span className="tnum text-ink text-2xl leading-none font-semibold">
              {funnel.booked} of 1
            </span>
          ) : (
            <CountUp
              value={rate}
              kind="percent"
              className="tnum text-ink text-[34px] leading-none font-semibold tracking-[-0.02em]"
            />
          )}
        </Ring>

        <div className="min-w-[12rem] flex-1">
          {empty ? (
            <>
              <p className="text-ink-2 text-[15px] leading-[22px]">No one has tried to book yet.</p>
              <p className="text-ink-3 mt-1 text-[13px] leading-[18px]">
                Bookings will show here after the first patient asks for an appointment.
              </p>
            </>
          ) : (
            <>
              <p className="text-ink-2 text-[15px] leading-[22px]">
                <strong className="text-ink tnum font-semibold">
                  {formatMetric("count", funnel.booked)} of {formatMetric("count", funnel.wanted)}
                </strong>{" "}
                booking {funnel.wanted === 1 ? "chat" : "chats"} ended in a confirmed appointment.
              </p>
              <TrendChip delta={delta} increaseIsGood className="mt-2" />
            </>
          )}
        </div>
      </div>

      <Funnel funnel={funnel} empty={empty} />
    </section>
  );
}

function Ring({ fraction, children }: { fraction: number; children: React.ReactNode }) {
  // Starts empty and sweeps to its value after mount, alongside the count-up.
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(fraction));
    return () => cancelAnimationFrame(frame);
  }, [fraction]);

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--bg-sunken)" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--booked)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, shown)))}
          style={{
            transition: "stroke-dashoffset var(--dur-slow) var(--ease-out)",
            opacity: shown > 0 ? 1 : 0,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

const STEPS: Array<{ key: keyof BookingFunnel; label: string }> = [
  { key: "wanted", label: "Wanted an appointment" },
  { key: "checkedSlots", label: "Agent found open slots" },
  { key: "booked", label: "Booked" },
];

function Funnel({ funnel, empty }: { funnel: BookingFunnel; empty: boolean }) {
  const top = Math.max(funnel.wanted, 1);
  return (
    <div className="relative mt-6 border-t border-(--line) pt-5">
      <p className="text-ink-2 mb-3 flex items-center gap-1.5 text-sm font-medium">
        <CalendarPlus className="text-booked size-4" aria-hidden="true" />
        Where booking chats stop
      </p>
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((step, index) => {
          const count = funnel[step.key];
          const width = empty ? 0 : (count / top) * 100;
          const lost = index > 0 ? funnel[STEPS[index - 1].key] - count : 0;
          return (
            <li key={step.key} className="grid grid-cols-[minmax(8.5rem,11rem)_1fr_auto] items-center gap-3">
              <span className="text-ink-2 truncate text-[13px]">{step.label}</span>
              <span className="bg-sunken h-2.5 overflow-hidden rounded-full">
                {width > 0 && (
                  <span
                    className="md-grow-x block h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      backgroundColor: step.key === "booked" ? "var(--booked)" : "color-mix(in srgb, var(--booked) 45%, var(--surface))",
                      animationDelay: `${150 + index * 40}ms`,
                    }}
                  />
                )}
              </span>
              <span className="tnum text-ink w-14 text-right text-[13px] font-medium">
                {formatMetric("count", count)}
                {lost > 0 && (
                  <span className="text-ink-3 sr-only">, {lost} stopped at this step</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
