import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <main className="w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-16">
      <div className="bg-surface border-line flex max-w-xl flex-col items-start gap-5 rounded-2xl border p-6 sm:p-8">
        <span className="bg-none-soft text-none-text flex size-11 items-center justify-center rounded-[10px]">
          <SearchX className="size-5" aria-hidden="true" />
        </span>

        <div>
          <h1 className="text-ink text-2xl leading-8 font-semibold">Nothing here</h1>
          <p className="text-ink-2 mt-2 text-[15px] leading-[22px]">
            This record may have been removed, or the link points at another clinic&apos;s
            records. Find it from the list instead.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/conversations">Go to Conversations</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/analytics">Go to Analytics</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
