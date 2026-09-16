import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getConversationsInRange } from "@/lib/data/conversations";
import { formatCount, formatDuration, formatPercent, median } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Analytics",
  description: "How the virtual receptionist performed over time.",
};

const RANGE_DAYS = 30;

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const to = new Date();
  const from = new Date(to.getTime() - RANGE_DAYS * 24 * 60 * 60 * 1000);
  const { conversations } = await getConversationsInRange(
    user.clinicId,
    from.toISOString(),
    to.toISOString(),
  );

  const total = conversations.length;
  const escalated = conversations.filter((c) => c.escalated).length;
  const booked = conversations.filter(
    (c) => c.outcome === "appointment_booked",
  ).length;
  const resolvedWithoutHuman = total > 0 ? 1 - escalated / total : 0;
  const medianDuration = median(conversations.map((c) => c.durationSec));

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        description={`How the agent performed over the last ${RANGE_DAYS} days.`}
      />

      {total === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-16 text-center">
            <p className="font-medium">No conversations in this range</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              Run <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">npm run seed</code>{" "}
              to load demo data, or point the agent at the ingestion endpoint.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Resolved without a human"
            value={formatPercent(resolvedWithoutHuman, 1)}
            emphasis
          />
          <Kpi label="Conversations handled" value={formatCount(total)} />
          <Kpi label="Appointments booked" value={formatCount(booked)} />
          <Kpi
            label="Median handling time"
            value={formatDuration(medianDuration)}
          />
        </div>
      )}
    </PageShell>
  );
}

function Kpi({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p
          className={
            emphasis
              ? "tabular text-status-booked mt-1 text-3xl font-semibold"
              : "tabular mt-1 text-2xl font-semibold"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
