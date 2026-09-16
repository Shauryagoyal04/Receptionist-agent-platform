import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="flex flex-col items-start gap-4">
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
          <FileQuestion className="size-5" />
        </span>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            We couldn&apos;t find that
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            The conversation may have been removed, or the link may point at a
            different clinic&apos;s records.
          </p>
        </div>

        <Button asChild>
          <Link href="/conversations">Back to conversations</Link>
        </Button>
      </div>
    </main>
  );
}
