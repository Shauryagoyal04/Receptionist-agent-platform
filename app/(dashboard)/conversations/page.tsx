import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { ConversationTable } from "@/components/conversations/conversation-table";
import { FilterBar } from "@/components/conversations/filter-bar";
import { Pagination } from "@/components/conversations/pagination";
import {
  NoConversationsYet,
  NoMatchingConversations,
} from "@/components/conversations/empty-states";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import {
  PAGE_SIZE,
  clinicHasAnyConversations,
  decodeCursor,
  listConversations,
} from "@/lib/data/conversations";
import {
  buildQueryString,
  hasActiveUrlFilters,
  parseCursorStack,
  parseUrlFilters,
  toDataFilters,
} from "@/lib/conversations/params";

export const metadata: Metadata = {
  title: "Conversations",
  description: "Browse and review what the virtual receptionist handled.",
};

export default async function ConversationsPage({
  searchParams,
}: PageProps<"/conversations">) {
  const user = await getCurrentUser();
  // The layout already redirected, but a Server Component must not assume
  // that — it can be rendered for a request the layout did not gate.
  if (!user) return null;

  const { DEFAULT_CLINIC_TIMEZONE: timeZone } = getServerEnv();

  // `searchParams` is a Promise in Next.js 16.
  const raw = await searchParams;
  const state = parseUrlFilters(raw, timeZone);
  const filters = toDataFilters(state, timeZone);
  const cursorStack = parseCursorStack(raw.cursor);
  const cursor = decodeCursor(cursorStack[cursorStack.length - 1] ?? null);

  const [page, anyExist] = await Promise.all([
    listConversations(user.clinicId, filters, cursor),
    clinicHasAnyConversations(user.clinicId),
  ]);

  const filtered = hasActiveUrlFilters(state);
  const queryString = buildQueryString(state, { cursors: cursorStack });

  const rangeStart = cursorStack.length * PAGE_SIZE + 1;
  const rangeEnd = rangeStart + page.conversations.length - 1;

  return (
    <PageShell>
      <PageHeader
        title="Conversations"
        description="Every call and chat the agent handled, newest first."
      />

      <div className="mt-6">
        <FilterBar state={state} timeZone={timeZone} />
      </div>

      {page.truncated && (
        <p
          role="status"
          className="text-status-abandoned bg-status-abandoned-tint mt-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            This filter combination had to scan a lot of records, so the list
            may be incomplete. Narrowing the date range will make it exact.
          </span>
        </p>
      )}

      <Card className="mt-4 overflow-hidden py-0">
        {page.conversations.length > 0 ? (
          <>
            <ConversationTable
              conversations={page.conversations}
              queryString={queryString}
            />
            <Pagination
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              previousHref={
                cursorStack.length > 0
                  ? `/conversations${buildQueryString(state, {
                      cursors: cursorStack.slice(0, -1),
                    })}`
                  : null
              }
              nextHref={
                page.nextCursor
                  ? `/conversations${buildQueryString(state, {
                      cursors: [...cursorStack, page.nextCursor],
                    })}`
                  : null
              }
            />
          </>
        ) : filtered || anyExist ? (
          <NoMatchingConversations />
        ) : (
          <NoConversationsYet />
        )}
      </Card>
    </PageShell>
  );
}
