import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import {
  OUTCOMES,
  OUTCOME_LABELS,
  SENTIMENTS,
  SENTIMENT_LABELS,
  SENTIMENT_TONE,
  STATUS_LABELS,
  CONVERSATION_STATUSES,
  TONE_DOT_CLASS,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Design tokens",
  description:
    "Reference rendering of the console's theme, status colors and controls.",
};

/** Surfaces and text colors inherited from the shadcn/ui theme. */
const THEME_TOKENS = [
  { token: "background", use: "App background" },
  { token: "card", use: "Cards, table, transcript panel" },
  { token: "muted", use: "Subdued fills, hovered rows" },
  { token: "border", use: "Borders and dividers" },
  { token: "primary", use: "Primary action" },
  { token: "secondary", use: "Secondary action" },
  { token: "accent", use: "Hover and active states" },
  { token: "destructive", use: "Destructive action" },
] as const;

/** Status colors layered on top of the theme. These carry meaning. */
const STATUS_TOKENS = [
  { token: "status-booked", use: "Booked, rescheduled, healthy" },
  { token: "status-escalated", use: "Escalated, negative sentiment" },
  { token: "status-abandoned", use: "Abandoned, cancelled, no resolution" },
  { token: "status-info", use: "Info provided, neutral" },
] as const;

export default function TokensPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-8 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Design tokens</h1>
        <p className="text-muted-foreground mt-1 max-w-prose">
          The vocabulary every screen in this console is built from. Neutral
          surfaces come from the shadcn/ui theme; the four status colors are
          layered on top and carry meaning, so they must stay consistent across
          badges, charts and filter chips.
        </p>
      </header>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Theme (shadcn/ui)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {THEME_TOKENS.map((swatch) => (
                <li
                  key={swatch.token}
                  className="overflow-hidden rounded-lg border"
                >
                  <div
                    className="h-14 w-full border-b"
                    style={{ backgroundColor: `var(--${swatch.token})` }}
                  />
                  <div className="px-3 py-2">
                    <p className="font-mono text-xs">--{swatch.token}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {swatch.use}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status colors</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STATUS_TOKENS.map((swatch) => (
                <li
                  key={swatch.token}
                  className="overflow-hidden rounded-lg border"
                >
                  <div
                    className="h-14 w-full border-b"
                    style={{ backgroundColor: `var(--${swatch.token})` }}
                  />
                  <div className="px-3 py-2">
                    <p className="font-mono text-xs">--{swatch.token}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {swatch.use}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {OUTCOMES.map((outcome) => (
                  <StatusBadge key={outcome} kind="outcome" value={outcome}>
                    {OUTCOME_LABELS[outcome]}
                  </StatusBadge>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {CONVERSATION_STATUSES.map((status) => (
                  <StatusBadge key={status} kind="status" value={status}>
                    {STATUS_LABELS[status]}
                  </StatusBadge>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {SENTIMENTS.map((sentiment) => (
                  <span key={sentiment} className="flex items-center gap-1.5">
                    <span
                      className={`size-2 rounded-full ${TONE_DOT_CLASS[SENTIMENT_TONE[sentiment]]}`}
                    />
                    <span className="text-sm">
                      {SENTIMENT_LABELS[sentiment]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-sm">
              IBM Plex Sans for all UI text. IBM Plex Mono only where figures
              must align in a column.
            </p>
            <ul className="divide-y">
              {(
                [
                  ["text-xs", "Dense metadata, chart axes"],
                  ["text-sm", "Labels, badges, captions"],
                  ["text-base", "Body and table default"],
                  ["text-lg", "Card headings"],
                  ["text-2xl", "Page headings, KPI figures"],
                ] as const
              ).map(([cls, use]) => (
                <li
                  key={cls}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 py-2.5"
                >
                  <span className={cls}>Dr. Mehta has 3 slots on 14 Oct</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {cls} · {use}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-4 border-t pt-3 text-sm">
              Mono, tabular:{" "}
              <span className="tabular font-mono">+91 98765 43210</span> ·{" "}
              <span className="tabular font-mono">4:27</span> ·{" "}
              <span className="tabular font-mono">2026-09-16 10:42</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button>Save note</Button>
            <Button variant="outline">Clear filters</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Escalate</Button>
            <Badge variant="secondary">Unreviewed</Badge>
            <Input
              className="w-56"
              placeholder="Search name or phone"
              aria-label="Search name or phone"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
