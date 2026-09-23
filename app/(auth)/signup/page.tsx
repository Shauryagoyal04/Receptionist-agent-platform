import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a clinic reception console account.",
};

export default function SignUpPage() {
  // Read on the server so the form can name the permitted domains before the
  // user types an address that will be rejected.
  const { signupAllowedDomains, googleEnabled } = getServerEnv();
  return <SignUpForm
      allowedDomains={signupAllowedDomains}
      googleEnabled={googleEnabled}
    />;
}
