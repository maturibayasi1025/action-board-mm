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
  SLACK_WEBHOOK_URL: z.string().optional(),
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

const OPTIONAL_URL_KEYS = ["NEXT_PUBLIC_SITE_URL", "SITE_URL"] as const;

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Worker 実行時の process.env（スプレッドしないと Next のビルド時インライン化を踏む） */
export function readRuntimeEnv(): NodeJS.ProcessEnv {
  return { ...process.env };
}

export function preprocessEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const preprocessed = { ...source };
  for (const key of Object.keys(preprocessed)) {
    if (preprocessed[key] === "") {
      preprocessed[key] = undefined;
    }
  }
  for (const key of OPTIONAL_URL_KEYS) {
    const value = preprocessed[key];
    if (value && !isAbsoluteHttpUrl(value)) {
      preprocessed[key] = undefined;
    }
  }
  return preprocessed;
}

function parseEnv(source: NodeJS.ProcessEnv = readRuntimeEnv()): Env {
  const parsed = envSchema.safeParse(preprocessEnv(source));
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

export function resetEnvCacheForTests(): void {
  cached = null;
}

export function resolveSupabasePublicCredentials(
  runtimeEnv: NodeJS.ProcessEnv = readRuntimeEnv(),
  inlined: { url?: string; anonKey?: string } = {},
): { url: string; anonKey: string } {
  return {
    url: runtimeEnv.NEXT_PUBLIC_SUPABASE_URL || inlined.url || "",
    anonKey: runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || inlined.anonKey || "",
  };
}

/** Public env vars safe for client bundles */
export function getPublicEnv() {
  const runtime = readRuntimeEnv();
  return {
    supabaseUrl:
      runtime.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "",
    supabaseAnonKey:
      runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
    siteUrl:
      runtime.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      runtime.SITE_URL ||
      process.env.SITE_URL ||
      "http://localhost:3000",
    sentryDsn:
      runtime.NEXT_PUBLIC_SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    gaId: runtime.NEXT_PUBLIC_GA_ID ?? process.env.NEXT_PUBLIC_GA_ID,
    lineClientId:
      runtime.NEXT_PUBLIC_LINE_CLIENT_ID ??
      process.env.NEXT_PUBLIC_LINE_CLIENT_ID,
    disableSentry:
      (runtime.NEXT_PUBLIC_DISABLE_SENTRY ??
        process.env.NEXT_PUBLIC_DISABLE_SENTRY) === "true",
  };
}

export function getSiteUrl(): string {
  const runtime = readRuntimeEnv();
  return (
    runtime.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    runtime.SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000"
  );
}
