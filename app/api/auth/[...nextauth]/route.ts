import { handlers } from "@/lib/auth";

/**
 * Auth.js mounts its whole surface here: the sign-in and callback endpoints,
 * the CSRF token, the session endpoint and the OAuth redirect handlers.
 */
export const { GET, POST } = handlers;
