import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck,
  Headset,
  Info,
  MessagesSquare,
  Timer,
} from "lucide-react";
import { z } from "zod";

import { PageHeader, PageShell } from "@/components/page-header";
import { ActivityTiles, type ActivityTile } from "@/components/analytics/activity-tiles";
import { BookingLead } from "@/components/analytics/booking-lead";
import { FailureReportButton } from "@/components/analytics/failure-report-button";
import { ChannelSplit } from "@/components/analytics/channel-split";
import { HoursChart } from "@/components/analytics/charts";
import { DotTimeline, SampleVolume } from "@/components/analytics/dot-timeline";
import { VOLUME_HEIGHT, formatDayKey, formatMetric, formatShare } from "@/components/analytics/format";
import { IntentBars } from "@/components/analytics/intent-bars";
import { OutcomeBar } from "@/components/analytics/outcome-bar";
import { Panel, PanelLink } from "@/components/analytics/panel";
import { RangePicker } from "@/components/analytics/range-picker";
import { RecentConversations } from "@/components/analytics/recent-conversations";
import { SetupGuide, type SetupStep } from "@/components/analytics/setup-guide";
import { VolumeChart } from "@/components/analytics/volume-chart";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { getClinicRecord, listDoctors } from "@/lib/data/clinic-records";
import { clinicHasAnyConversations, getConversationsInRange } from "@/lib/data/conversations";
import { MAX_LATEST_FAILURES, getActiveFailureReport } from "@/lib/data/failure-reports";
import { aggregate, buildKpis, precedingRange, type KpiId } from "@/lib/analytics/aggregate";
import { closedWeekdays } from "@/lib/analytics/closed-days";
import {
  addDaysToDateKey,
  isDateOnly,
  zonedEndOfDay,
  zonedStartOfDay,
  zonedToday,
} from "@/lib/time";
import {
  OUTCOMES,
  handoffCopy,
  outcomeLabels,
  type Channel,
  type Outcome,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Analytics",
  description: "How the virtual receptionist performed over time.",
};

const DEFAULT_DAYS = 30;
/** Below this many conversations the trend chart becomes a dot timeline. */
const TREND_MIN = 5;
const dateKey = z.string().refine(isDateOnly);
/** WhatsApp first: it is the main channel, so it sits on the baseline. */
const CHANNEL_ORDER: Channel[] = ["whatsapp", "voice", "web_chat"];

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { DEFAULT_CLINIC_TIMEZONE: timeZone, capabilities } = getServerEnv();
  const raw = await searchParams;
  const isAdmin = user.role === "admin";

  const today = zonedToday(timeZone);
  const parsedFrom = dateKey.safeParse(first(raw.from));
  const parsedTo = dateKey.safeParse(first(raw.to));
  let from = parsedFrom.success ? parsedFrom.data : addDaysToDateKey(today, -(DEFAULT_DAYS - 1));
  let to = parsedTo.success ? parsedTo.data : today;
  // A reversed range is a typo, not an empty result set.
  if (from > to) [from, to] = [to, from];

  const previous = precedingRange(from, to);
  // Clinic details and doctors only feed the closed-day shading and the setup
  // guide; neither is worth failing the page for.
  const [currentRows, previousRows, clinic, doctors, hasAny, activeReport] = await Promise.all([
    getConversationsInRange(
      user.clinicId,
      zonedStartOfDay(from, timeZone) ?? from,
      zonedEndOfDay(to, timeZone) ?? to,
    ),
    getConversationsInRange(
      user.clinicId,
      zonedStartOfDay(previous.from, timeZone) ?? previous.from,
      zonedEndOfDay(previous.to, timeZone) ?? previous.to,
    ),
    getClinicRecord(user.clinicId).catch(() => null),
    listDoctors(user.clinicId).catch(() => null),
    clinicHasAnyConversations(user.clinicId).catch(() => true),
    // A report already being prepared (another tab or admin) shows as in progress.
    isAdmin ? getActiveFailureReport(user.clinicId).catch(() => null) : Promise.resolve(null),
  ]);

  const summary = aggregate(currentRows.conversations, { from, to, timeZone });
  const prior = aggregate(previousRows.conversations, {
    from: previous.from,
    to: previous.to,
    timeZone,
  });
  const kpis = buildKpis(summary, prior, { handoffEnabled: capabilities.handoffEnabled });
  const delta = (id: KpiId) => kpis.find((kpi) => kpi.id === id)?.delta ?? null;

  const handoff = handoffCopy(capabilities.handoffEnabled);
  const labels = outcomeLabels(capabilities.handoffEnabled);
  const closed = closedWeekdays(clinic?.timings ?? null);

  // Links into the lists behind each number, scoped to this date range.
  const list = (extra: Record<string, string> = {}) =>
    `/conversations?${new URLSearchParams({ from, to, ...extra }).toString()}`;
  const outcomeHref = Object.fromEntries(
    OUTCOMES.map((outcome) => [outcome, list({ outcome })]),
  ) as Record<Outcome, string>;
  const humanHref = capabilities.handoffEnabled ? "/escalations" : outcomeHref.escalated;

  // Channels turned on, plus any that still have history in this range.
  const channelCount = (channel: Channel) =>
    summary.byChannel.find((entry) => entry.key === channel)?.count ?? 0;
  const channels = CHANNEL_ORDER.filter(
    (channel) => capabilities.enabledChannels.includes(channel) || channelCount(channel) > 0,
  );
  const showChannels = channels.length > 1;

  const total = summary.total;
  const isNewClinic = !hasAny;

  const tiles: ActivityTile[] = [
    {
      id: "handled",
      label: "Conversations handled",
      icon: MessagesSquare,
      meaning: "agent",
      value: total,
      kind: "count",
      delta: delta("handled"),
      increaseIsGood: true,
      series: summary.days.map((d) => d.total),
      context:
        total === 0
          ? undefined
          : showChannels
            ? channels.map((c) => `${formatMetric("count", channelCount(c))} on ${channelName(c)}`).join(" · ")
            : `${summary.avgMessagesPerConversation.toFixed(1)} messages per conversation`,
      href: list(),
    },
    {
      id: "booked",
      label: "Booked",
      icon: CalendarCheck,
      meaning: "booked",
      value: summary.booked,
      kind: "count",
      delta: delta("booked"),
      increaseIsGood: true,
      series: summary.days.map((d) => d.booked),
      context: total === 0 ? undefined : `${formatShare(summary.booked / total)} of all conversations`,
      href: outcomeHref.appointment_booked,
    },
    {
      id: "escalated",
      label: "Asked for a human",
      icon: Headset,
      meaning: "human",
      value: summary.escalated,
      kind: "count",
      delta: delta("escalated"),
      increaseIsGood: false,
      series: summary.days.map((d) => d.escalated),
      context:
        total === 0
          ? undefined
          : `${formatMetric("count", summary.escalated)} of ${formatMetric("count", total)} chats`,
      href: humanHref,
    },
    {
      id: "medianDuration",
      label: "Median handling time",
      icon: Timer,
      meaning: "answered",
      value: summary.medianDurationSec,
      kind: "duration",
      delta: delta("medianDuration"),
      increaseIsGood: false,
      series: summary.days.map((d) => d.medianDurationSec),
      context:
        total === 0
          ? undefined
          : `About ${Math.round(summary.avgMessagesPerConversation)} messages each`,
      href: list(),
    },
  ];

  const setupSteps: SetupStep[] = [
    {
      id: "clinic",
      label: "Add clinic name, phone, timings and address",
      done: Boolean(clinic?.clinicName && clinic.phone && clinic.timings && clinic.address),
      href: isAdmin ? "/clinic" : undefined,
      hrefLabel: "Clinic",
    },
    {
      id: "doctors",
      label: "Add at least one doctor with working days",
      done: (doctors?.length ?? 0) > 0,
      href: isAdmin ? "/doctors/new" : undefined,
      hrefLabel: "Add doctor",
    },
    {
      id: "first",
      label: "Send a test WhatsApp message to the clinic number",
      done: hasAny,
    },
  ];

  const allNoResolution =
    total > 0 && summary.byOutcome.find((o) => o.key === "no_resolution")?.count === total;

  return (
    <PageShell>
      <PageHeader title="Analytics">
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdmin && (
              <FailureReportButton
                from={from}
                to={to}
                timeZone={timeZone}
                maxLatest={MAX_LATEST_FAILURES}
                initialJob={activeReport}
              />
            )}
            <RangePicker from={from} to={to} timeZone={timeZone} />
          </div>
        </div>
      </PageHeader>

      {currentRows.truncated && (
        <p
          role="status"
          className="bg-sunken text-ink-2 mt-5 flex items-start gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px]"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This range has more conversations than the page reads at once, so these figures use the
          most recent ones. Pick a shorter range for exact numbers.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {isNewClinic && <SetupGuide steps={setupSteps} />}

        {/* Lead + activity */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <BookingLead
            rate={summary.bookingCompletionRate}
            funnel={summary.bookingFunnel}
            delta={delta("bookingRate")}
            bookedHref={outcomeHref.appointment_booked}
          />
          <ActivityTiles tiles={tiles} />
        </div>

        {/* Volume, with the channel split beside it when there's more than one */}
        <div className={showChannels ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]" : ""}>
          {showChannels && (
            <Panel title="By channel">
              <ChannelSplit
                data={summary.byChannel}
                channels={channels}
                hrefFor={(channel) => list({ channel })}
              />
            </Panel>
          )}
          <Panel
            title="Conversation volume"
            srTable={{
              caption: "Conversations per day",
              rows: summary.days.map((d) => ({
                label: formatDayKey(d.day, timeZone),
                value: `${d.total} conversations, ${d.escalated} ${handoff.seriesLabel.toLowerCase()}`,
              })),
            }}
          >
            {total === 0 ? (
              <SampleVolume height={VOLUME_HEIGHT} />
            ) : total < TREND_MIN ? (
              <DotTimeline
                conversations={summary.recentConversations}
                from={from}
                to={to}
                timeZone={timeZone}
                height={VOLUME_HEIGHT}
              />
            ) : (
              <div aria-hidden="true">
                <VolumeChart
                  days={summary.days}
                  channels={channels.length > 0 ? channels : ["whatsapp"]}
                  closedWeekdays={closed}
                  today={today}
                  timeZone={timeZone}
                  humanLabel={handoff.seriesLabel}
                />
              </div>
            )}
          </Panel>
        </div>

        {/* How chats ended, and what they were about */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="How chats ended">
            {total === 0 ? (
              <div>
                <div className="bg-sunken h-3 rounded-full" />
              </div>
            ) : (
              <>
                <OutcomeBar data={summary.byOutcome} labels={labels} hrefFor={outcomeHref} />
                {allNoResolution && (
                  <p className="text-ink-3 mt-4 text-[13px]">
                    None of these chats reached an outcome.{" "}
                    <Link href={outcomeHref.no_resolution} className="text-agent-text font-medium underline-offset-2 hover:underline">
                      Open them to see where they stopped
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </Panel>

          <Panel title="What patients asked about">
            <IntentBars data={summary.byIntent} hrefFor={(intent) => list({ intent })} />
          </Panel>
        </div>

        {/* Detail: the latest chats, and when the desk is busiest */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel
            title="Recent conversations"
            action={total > 0 ? <PanelLink href={list()}>View all</PanelLink> : undefined}
          >
            <RecentConversations rows={summary.recentConversations} labels={labels} timeZone={timeZone} />
          </Panel>

          <Panel
            title="Busiest hours"
            srTable={{
              caption: "Conversations by hour of day",
              rows: summary.hours
                .map((count, hour) => ({ label: `${hour}:00`, value: `${count} conversations` }))
                .filter((row) => !row.value.startsWith("0 ")),
            }}
          >
            {total < TREND_MIN ? (
              <p className="text-ink-3 text-[13px]">Not enough data yet.</p>
            ) : (
              <div aria-hidden="true">
                <HoursChart hours={summary.hours} />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function channelName(channel: Channel): string {
  return channel === "whatsapp" ? "WhatsApp" : channel === "voice" ? "voice" : "web chat";
}
