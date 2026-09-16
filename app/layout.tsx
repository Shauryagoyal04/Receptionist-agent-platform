import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

/*
 * IBM Plex Sans carries the UI. IBM Plex Mono is reserved for figures that
 * have to line up in a column — timestamps, durations, phone numbers and IDs
 * — never for labels or headings. Both are exposed as CSS variables that
 * `app/globals.css` feeds into shadcn's `--font-sans` / `--font-mono`.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Reception Console",
    template: "%s · Reception Console",
  },
  description:
    "Review what the virtual receptionist handled: conversations, transcripts and analytics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
