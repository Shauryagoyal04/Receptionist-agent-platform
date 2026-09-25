import "server-only";

import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";

import { getMongoClientPromise } from "@/lib/mongodb";
import { getServerEnv } from "@/lib/env";
import { buildAuthConfig } from "@/lib/auth/config";
import { COLLECTIONS } from "@/lib/mongodb";

/*
 * The single NextAuth instance. `auth()` is the server-side session reader,
 * `handlers` back the /api/auth/[...nextauth] route, and `signOut` is used by
 * the sign-out button through a Server Action.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...buildAuthConfig(),
  adapter: MongoDBAdapter(getMongoClientPromise(), {
    databaseName: getServerEnv().MONGODB_DB,
    collections: {
      Users: COLLECTIONS.users,
      Accounts: COLLECTIONS.accounts,
      Sessions: COLLECTIONS.sessions,
      VerificationTokens: COLLECTIONS.verificationTokens,
    },
  }),
  secret: getServerEnv().AUTH_SECRET,
  /*
   * Trust the Host header.
   *
   * Auth.js refuses every request with UntrustedHost in production unless it
   * either knows its own origin (AUTH_URL) or is told to trust the incoming
   * host. Vercel sets this automatically; a self-hosted `next start` does not,
   * so without it a production build fails to sign anyone in — while `next
   * dev` works fine, which makes it easy to ship.
   *
   * Safe here because the app sits behind a single known origin. Set AUTH_URL
   * instead if it is ever served behind a proxy that rewrites Host.
   */
  trustHost: true,
}));
