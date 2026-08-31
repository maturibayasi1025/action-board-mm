import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_DISABLE_SENTRY: z.string().optional(),
  DISABLE_SENTRY: z.string().optional(),
  SENTRY_DEBUG: z.string().optional(),
  LINE_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_LINE_CLIENT_ID: z.string().optional(),
  BATCH_ADMIN_KEY: z.string().optional(),
  MCP_API_KEYS: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  SLACK_WEBHOOK_URL_ENPS: z.string().optional(),
  SLACK_WEBHOOK_URL_AWARD: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_MONITOR_CHANNEL_ID: z.string().optional(),
  MAILGUN_API_BASE_URL: z.string().optional(),
  OWNER_USER_IDS: z.string().optional(),
  OWNER_EMAILS: z.string().optional(),
  SURVEY_ENPS_POST_MISSION_ID: z.string().optional(),
  SURVEY_AWARD_POST_MISSION_ID: z.string().optional(),
  STANDALONE_BUILD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const preprocessed = { ...process.env };
  for (const key of Object.keys(preprocessed)) {
    if (preprocessed[key] === "") {
      preprocessed[key] = undefined;
    }
  }
  const parsed = envSchema.safeParse(preprocessed);
  if (!parsed.success) {
    const missing = parsed.error.errors.map((e) => e.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${missing}`);
  }
  return parsed.data;
}

let cached: Env | null = null;

/** Server-side env access with validation */
export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv();
  }
  return cached;
}

/** Public env vars safe for client bundles */
export function getPublicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      "http://localhost:3000",
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    gaId: process.env.NEXT_PUBLIC_GA_ID,
    lineClientId: process.env.NEXT_PUBLIC_LINE_CLIENT_ID,
    disableSentry: process.env.NEXT_PUBLIC_DISABLE_SENTRY === "true",
  };
}

export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "http://localhost:3000"
  );
}
