import { compare } from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
// Imported for its side effect: the `declare module` below can only augment a
// module TypeScript can resolve from this file.
import type {} from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import {
  findUserByEmail,
  markSignedIn,
  provisionOAuthUser,
} from "@/lib/data/users";
import type { UserRole } from "@/lib/types";

/*
 * Auth.js (NextAuth v5) configuration.
 *
 * Session strategy is JWT because the Credentials provider requires it — a
 * database session cannot be created for a credentials sign-in. The MongoDB
 * adapter is still used for Google, so OAuth accounts are linked in the
 * `accounts` collection rather than re-created on every sign-in.
 *
 * `role` and `clinicId` are authorization inputs, so they are read from the
 * database on sign-in and carried in the token. They are never accepted from
 * the client.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string | null;
      name: string | null;
      image: string | null;
      role: UserRole;
      clinicId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: UserRole;
    clinicId: string;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function domainOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/** Shared by Google sign-in and the sign-up action. */
export function isAllowedDomain(email: string | null | undefined): boolean {
  const allowed = getServerEnv().signupAllowedDomains;
  if (allowed.length === 0) return true;
  const domain = domainOf(email);
  return domain !== null && allowed.includes(domain);
}

export function buildAuthConfig(): NextAuthConfig {
  const env = getServerEnv();

  const providers: NextAuthConfig["providers"] = [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await findUserByEmail(parsed.data.email);
        // An account created purely through Google has no password hash;
        // returning null keeps the failure indistinguishable from a wrong
        // password, so this cannot be used to enumerate sign-in methods.
        if (!user?.passwordHash) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await markSignedIn(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.photoURL,
        };
      },
    }),
  ];

  // Only offered when actually configured, so the button cannot appear and
  // then fail with an opaque OAuth error.
  if (env.googleEnabled) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  return {
    providers,
    session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60 },
    pages: { signIn: "/login", error: "/login" },
    callbacks: {
      async signIn({ user, account }) {
        // The allowlist is enforced for Google here, because there is no
        // separate sign-up step for OAuth — the first sign-in creates the
        // account.
        if (account?.provider === "google") {
          if (!isAllowedDomain(user.email)) return false;
          await provisionOAuthUser({
            email: user.email ?? null,
            displayName: user.name ?? null,
            photoURL: user.image ?? null,
          });
        }
        return true;
      },

      async jwt({ token, user }) {
        // Only runs with `user` on the sign-in request itself; afterwards the
        // claims are already on the token.
        if (user?.email) {
          const record = await findUserByEmail(user.email);
          if (record) {
            token.uid = record.id;
            token.role = record.role;
            token.clinicId = record.clinicId;
          }
        }
        return token;
      },

      async session({ session, token }) {
        // Merged rather than replaced: the adapter's user object carries
        // fields (emailVerified) that the session type still requires.
        session.user = {
          ...session.user,
          id: token.uid,
          role: token.role,
          clinicId: token.clinicId,
        };
        return session;
      },
    },
  };
}
