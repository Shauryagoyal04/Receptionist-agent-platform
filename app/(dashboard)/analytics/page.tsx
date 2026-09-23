import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { z } from "zod";

import { PageHeader, PageShell } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/analytics/kpi-card";
import { OutcomeBar } from "@/components/analytics/outcome-bar";
import { ChartFrame } from "@/components/analytics/chart-frame";
import {
  ChannelSplit,
  HoursChart,
  IntentChart,
  SentimentChart,
  VolumeChart,
} from "@/components/analytics/charts";
import {
  EscalationTable,
  ToolReliabilityTable,
  ViewAllLink,
} from "@/components/analytics/tables";
import { RangePicker } from "@/components/analytics/range-picker";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { getConversationsInRange } from "@/lib/data/conversations";
import {
  aggregate,
  buildKpis,
  precedingRange,
} from "@/lib/analytics/aggregate";
import {
  addDaysToDateKey,
  daysBetweenKeys,
  formatInZone,
  isDateOnly,
  zonedEndOfDay,
  zonedStartOfDay,
  zonedToday,
} from "@/lib/time";
import { INTENT_LABELS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Analytics",
  description: "How the virtual receptionist performed over time.",
};

const DEFAULT_DAYS = 30;
const dateKey = z.string().refine(isDateOnly);

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function AnalyticsPage({
  searchParams,
}: PageProps<"/analytics">) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { DEFAULT_CLINIC_TIMEZONE: timeZone } = getServerEnv();
  const raw = await searchParams;

  const today = zonedToday(timeZone);
  const parsedFrom = dateKey.safeParse(first(raw.from));
  const parsedTo = dateKey.safeParse(first(raw.to));

  let from = parsedFrom.success ? parsedFrom.data : addDaysToDateKey(today, -(DEFAULT_DAYS - 1));
  let to = parsedTo.success ? parsedTo.data : today;
  // A reversed range is a typo, not an empty result set.
  if (from > to) [from, to] = [to, from];

  const previous = precedingRange(from, to);
  const rangeDays = daysBetweenKeys(from, to);

  // Both periods are fetched, then both go through the same pure aggregation.
  // Keeping fetch and compute separate is what lets pre-aggregated rollups
  // replace this fetcher later without touching a single chart.
  const [currentRows, previousRows] = await Promise.all([
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
  ]);

  const summary = aggregate(currentRows.conversations, { from, to, timeZone });
  const priorSummary = aggregate(previousRows.conversations, {
    from: previous.from,
    to: previous.to,
    timeZone,
  });

  const kpis = buildKpis(summary, priorSummary);
  const [headline, ...rest] = kpis;
  const isEmpty = summary.total === 0;
  const periodLabel = `previous ${rangeDays} days`;

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        description={`How the agent performed over ${rangeDays} days, in the clinic's local time.`}
      >
        <RangePicker from={from} to={to} timeZone={timeZone} />
      </PageHeader>

      {currentRows.truncated && (
        <p
          role="status"
          className="text-status-abandoned bg-status-abandoned-tint mt-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            This range holds more conversations than the page reads at once, so
            the figures below are based on the most recent slice. Narrow the
            range for exact numbers.
          </span>
        </p>
      )}

      {isEmpty ? (
        <Card className="mt-6">
          <CardContent className="py-16 text-center">
            <p className="font-medium">No conversations in this range</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              Try a wider date range, run{" "}
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                npm run seed
              </code>{" "}
              for demo data, or connect the agent to the ingestion endpoint.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* The headline number gets its own column and visual weight; the
              other five sit beside it. */}
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <KpiCard kpi={headline} emphasis periodLabel={periodLabel} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((kpi) => (
                <KpiCard key={kpi.id} kpi={kpi} periodLabel={periodLabel} />
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartFrame
              title="Conversation volume"
              description="Daily totals, with escalations overlaid"
              isEmpty={false}
              className="lg:col-span-2"
              tableCaption="Conversations and escalations per day"
              tableRows={summary.days.map((bucket) => ({
                label: formatInZone(`${bucket.day}T12:00:00.000Z`, timeZone, {
                  dateStyle: "medium",
                }),
                value: `${bucket.total} conversations, ${bucket.escalated} escalated`,
              }))}
            >
              <VolumeChart days={summary.days} timeZone={timeZone} />
            </ChartFrame>

            <Card className="gap-0 py-0">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-medium">Outcomes</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-3 pb-4">
                <OutcomeBar data={summary.byOutcome} />
              </CardContent>
            </Card>

            <ChartFrame
              title="Intent distribution"
              isEmpty={false}
              tableCaption="Conversations by primary intent"
              tableRows={summary.byIntent
                .filter((entry) => entry.count > 0)
                .sort((a, b) => b.count - a.count)
                .map((entry) => ({
                  label: INTENT_LABELS[entry.key],
                  value: `${entry.count} (${(entry.share * 100).toFixed(1)}%)`,
                }))}
            >
              <IntentChart data={summary.byIntent} />
            </ChartFrame>

            <ChartFrame
              title="Busiest hours"
              description="Clinic local time — what staffing follows"
              isEmpty={false}
              tableCaption="Conversations by hour of day, clinic local time"
              tableRows={summary.hours.map((count, hour) => ({
                label: `${String(hour).padStart(2, "0")}:00`,
                value: `${count} conversations`,
              }))}
            >
              <HoursChart hours={summary.hours} />
            </ChartFrame>

            <ChartFrame
              title="Negative sentiment"
              description="Share of conversations per day"
              isEmpty={false}
              tableCaption="Share of conversations ending in negative sentiment, per day"
              tableRows={summary.days.map((bucket) => ({
                label: formatInZone(`${bucket.day}T12:00:00.000Z`, timeZone, {
                  dateStyle: "medium",
                }),
                value:
                  bucket.total > 0
                    ? `${((bucket.negative / bucket.total) * 100).toFixed(1)}% (${bucket.negative} of ${bucket.total})`
                    : "no conversations",
              }))}
            >
              <SentimentChart days={summary.days} timeZone={timeZone} />
            </ChartFrame>

            <Card className="gap-0 py-0 lg:col-span-2">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-medium">Channels</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-3 pb-4">
                <ChannelSplit data={summary.byChannel} />
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="gap-0 overflow-hidden py-0">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-sm font-medium">
                  Recent escalations
                </CardTitle>
                <ViewAllLink
                  href="/conversations?outcome=escalated"
                  label="All escalations"
                />
              </CardHeader>
              <EscalationTable rows={summary.recentEscalations} />
            </Card>

            <Card className="gap-0 overflow-hidden py-0">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-sm font-medium">
                  Tool reliability
                </CardTitle>
              </CardHeader>
              <ToolReliabilityTable rows={summary.toolReliability} />
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}
