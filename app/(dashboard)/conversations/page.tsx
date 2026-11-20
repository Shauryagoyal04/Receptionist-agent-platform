import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/page-header";
import { ConversationTable } from "@/components/conversations/conversation-table";
import { FilterBar } from "@/components/conversations/filter-bar";
import { Pagination } from "@/components/conversations/pagination";
import {
  NoConversationsYet,
  NoMatchingConversations,
} from "@/components/conversations/empty-states";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import {
  PAGE_SIZE,
  clinicHasAnyConversations,
  listConversations,
} from "@/lib/data/conversations";
import {
  buildQueryString,
  hasActiveUrlFilters,
  parsePage,
  parseUrlFilters,
  toDataFilters,
} from "@/lib/conversations/params";
import { INTENT_LABELS, outcomeLabels } from "@/lib/types";

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

  const { DEFAULT_CLINIC_TIMEZONE: timeZone, capabilities } = getServerEnv();

  // `searchParams` is a Promise in Next.js 16.
  const raw = await searchParams;
  const state = parseUrlFilters(raw, timeZone);
  const filters = toDataFilters(state, timeZone);

  const [page, anyExist] = await Promise.all([
    listConversations(user.clinicId, filters, parsePage(raw.page)),
    clinicHasAnyConversations(user.clinicId),
  ]);

  const filtered = hasActiveUrlFilters(state);
  const queryString = buildQueryString(state, { page: page.page });
  const rangeStart = (page.page - 1) * PAGE_SIZE + 1;

  // Names the filter in the empty state ("No conversations match 'Cancelled'"),
  // when it is simple enough to say in a few words.
  const outcomeName = outcomeLabels(capabilities.handoffEnabled);
  const facetNames = [
    ...state.outcome.map((value) => outcomeName[value]),
    ...state.intent.map((value) => INTENT_LABELS[value]),
  ];
  const filterSummary =
    state.q.length > 0
      ? `“${state.q}”`
      : facetNames.length > 0 && facetNames.length <= 2
        ? `“${facetNames.join("” or “")}”${state.from ? " in this range" : ""}`
        : undefined;

  return (
    <PageShell>
      <PageHeader
        title="Conversations"
      />

      {/* One container: the toolbar sits on top of the table it filters. */}
      <section
        aria-label="Conversations"
        className="bg-surface border-line mt-6 overflow-hidden rounded-xl border"
      >
        <div className="border-line border-b p-3">
          <FilterBar
          state={state}
          timeZone={timeZone}
          enabledChannels={capabilities.enabledChannels}
          showChannelUi={capabilities.showChannelUi}
          handoffEnabled={capabilities.handoffEnabled}
          />
        </div>

        {page.conversations.length > 0 ? (
          <>
            <ConversationTable
              conversations={page.conversations}
              queryString={queryString}
              showChannel={capabilities.showChannelUi}
              handoffEnabled={capabilities.handoffEnabled}
              timeZone={timeZone}
            />
            <Pagination
              page={page.page}
              pageCount={page.pageCount}
              total={page.total}
              rangeStart={rangeStart}
              rangeEnd={rangeStart + page.conversations.length - 1}
              hrefFor={(target) =>
                `/conversations${buildQueryString(state, { page: target })}`
              }
            />
          </>
        ) : filtered || anyExist ? (
          <NoMatchingConversations summary={filterSummary} />
        ) : (
          <NoConversationsYet />
        )}
      </section>
    </PageShell>
  );
}
