import { createAuthClient } from "better-auth/react";
import { organizationClient, twoFactorClient } from "better-auth/client/plugins";

const AUTH_URL =
  (import.meta.env.VITE_AUTH_URL as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [
    organizationClient(),
    twoFactorClient(),
  ],
});
