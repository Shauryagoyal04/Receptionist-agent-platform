import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the clinic reception console.",
};

function SignInFallback() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function LoginPage() {
  // SignInForm reads `?next=` with useSearchParams, which needs a Suspense
  // boundary so the rest of the page can still be prerendered.
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm />
    </Suspense>
  );
}
