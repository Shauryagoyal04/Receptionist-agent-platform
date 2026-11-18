import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** "← Doctors" above a detail page's title; the arrow nudges on hover. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group/back text-ink-3 hover:text-ink mb-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium transition-colors duration-(--dur-quick)"
    >
      <ArrowLeft className="size-3.5 transition-transform duration-(--dur-quick) group-hover/back:-translate-x-0.5" />
      {children}
    </Link>
  );
}
