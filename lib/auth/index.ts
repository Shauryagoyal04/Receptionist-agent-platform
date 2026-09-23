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
}));
