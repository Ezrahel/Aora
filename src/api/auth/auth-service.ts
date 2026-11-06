import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { twoFactor } from "better-auth/plugins/two-factor";
import { organization } from "better-auth/plugins/organization";
import { bearer } from "better-auth/plugins/bearer";
import { dash } from "@better-auth/infra";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.ts";
import { ensureDefaultOrganization } from "./provision.ts";

// ── Pool ───────────────────────────────────────────────────

let pool: pg.Pool;
let db: ReturnType<typeof drizzle>;

function getPool(): pg.Pool {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL is required for Better Auth");
    }
    pool = new pg.Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      application_name: "aora_auth",
    });
  }
  return pool;
}

function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

// ── Better Auth Instance (lazy) ─────────────────────────────

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
    }),

      // Public URL for callbacks and redirects.
      // Falls back to the incoming request's host header.
      baseURL: process.env.BETTER_AUTH_URL,

      // Trust the X-Forwarded-For header when behind a reverse proxy
      trustedOrigins: process.env.TRUSTED_ORIGINS
        ? process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim())
        : ["http://localhost:3000", "http://localhost:5173"],

      // The session guard authorizes on user.role, which only reaches the session
      // if declared here. input: false stops sign-up from setting its own role.
      user: {
        additionalFields: {
          role: { type: "string", required: false, defaultValue: "member", input: false },
        },
      },

      // ── Email / Password Credential Provider ─────────────────
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 10,
        maxPasswordLength: 128,
        requireEmailVerification: false,
        sendResetPassword: async ({ user, url }) => {
          console.log(`[Auth] Password reset link for ${user.email}: ${url}`);
        },
      },

      // ── Social Providers ─────────────────────────────────────
      socialProviders: {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID ?? "",
          clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
          enabled: !!process.env.GITHUB_CLIENT_ID,
        },
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          enabled: !!process.env.GOOGLE_CLIENT_ID,
        },
      },

      // ── Plugins ──────────────────────────────────────────────
      plugins: [
        organization({
          allowUserToCreateOrganization: true,
          organizationLimit: 10,
        }),
        twoFactor(),
        bearer(),
        dash({
          apiKey: process.env.BETTER_AUTH_API_KEY,
          apiTimeout: 10_000,
          kvTimeout: 5_000,
        }),
      ],

      // ── Advanced Options ─────────────────────────────────────
      advanced: {
        defaultCookieAttributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        },
        crossSubDomainCookies: {
          enabled: false,
        },
      },

      // ── Session Lifetimes ────────────────────────────────────
      // 7-day session with 24h sliding refresh. Reasonable for a
      // billing dashboard — long enough to avoid constant re-logins,
      // short enough to bound the window if a session is stolen.
      session: {
        expiresIn: 60 * 60 * 24 * 7,   // 7 days
        updateAge: 60 * 60 * 24,       // refresh after 24h of activity
      },

      // ── Rate Limiting ────────────────────────────────────────
      // Built-in special rules already lock down /sign-in, /sign-up,
      // and password-reset endpoints. We add stricter rules for the
      // 2FA endpoints, which are a common brute-force target.
      rateLimit: {
        window: 60,
        max: 50,
        customRules: {
          "/two-factor/verify-otp": { window: 60, max: 5 },
          "/two-factor/verify-totp": { window: 60, max: 5 },
          "/two-factor/verify-backup-code": { window: 60, max: 3 },
          "/two-factor/send-otp": { window: 60, max: 3 },
          "/two-factor/verify": { window: 60, max: 5 },
        },
      },

      // ── Auth Event Logging (observability) ───────────────────
      databaseHooks: {
        user: {
          create: {
            after: async (user) => {
              console.log(`[Auth] User created: ${user.id} (${user.email})`);
            },
          },
        },
        session: {
          create: {
            // Every dashboard route needs an active organization, so a session
            // always starts with one. Runs per session so social sign-ups and
            // accounts created before this hook existed are covered too.
            before: async (session) => {
              const activeOrganizationId = await ensureDefaultOrganization(session.userId);
              return { data: { ...session, activeOrganizationId } };
            },
            after: async (session) => {
              console.log(
                `[Auth] Session created: user=${session.userId} id=${session.id} expires=${session.expiresAt.toISOString()}`,
              );
            },
          },
          delete: {
            after: async (session) => {
              console.log(`[Auth] Session deleted: user=${session.userId} id=${session.id}`);
            },
          },
        },
      },
    });
}

type Auth = ReturnType<typeof createAuth>;

let _auth: Auth | null = null;

export function getAuth(): Auth {
  if (!_auth) {
    _auth = createAuth();
  }
  return _auth;
}

export type { Auth };
