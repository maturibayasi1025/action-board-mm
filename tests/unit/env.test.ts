import {
  getEnv,
  getSiteUrl,
  preprocessEnv,
  resetEnvCacheForTests,
  resolveSupabasePublicCredentials,
} from "@/lib/env";

describe("getSiteUrl", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalSiteUrlAlt = process.env.SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
    if (originalSiteUrlAlt === undefined) {
      // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = originalSiteUrlAlt;
    }
  });

  it("returns NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
    delete process.env.SITE_URL;
    expect(getSiteUrl()).toBe("https://example.com");
  });

  it("falls back to SITE_URL then localhost", () => {
    // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.SITE_URL = "https://fallback.example.com";
    expect(getSiteUrl()).toBe("https://fallback.example.com");

    // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
    delete process.env.SITE_URL;
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});

describe("preprocessEnv", () => {
  it("drops empty strings and invalid optional URLs", () => {
    const processed = preprocessEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      NEXT_PUBLIC_SITE_URL: "not-a-url",
      SITE_URL: "",
    });

    expect(processed.NEXT_PUBLIC_SITE_URL).toBeUndefined();
    expect(processed.SITE_URL).toBeUndefined();
    expect(processed.NEXT_PUBLIC_SUPABASE_URL).toBe(
      "https://example.supabase.co",
    );
  });
});

describe("resolveSupabasePublicCredentials", () => {
  it("prefers runtime env over inlined build values", () => {
    const resolved = resolveSupabasePublicCredentials(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://runtime.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "runtime-anon",
      },
      {
        url: "https://inlined.supabase.co",
        anonKey: "inlined-anon",
      },
    );

    expect(resolved).toEqual({
      url: "https://runtime.supabase.co",
      anonKey: "runtime-anon",
    });
  });

  it("falls back to inlined values when runtime vars are missing", () => {
    const resolved = resolveSupabasePublicCredentials(
      {},
      {
        url: "https://inlined.supabase.co",
        anonKey: "inlined-anon",
      },
    );

    expect(resolved).toEqual({
      url: "https://inlined.supabase.co",
      anonKey: "inlined-anon",
    });
  });
});

describe("getEnv", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalSiteUrlAlt = process.env.SITE_URL;

  beforeEach(() => {
    resetEnvCacheForTests();
  });

  afterEach(() => {
    resetEnvCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    if (originalSiteUrl === undefined) {
      // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
    if (originalSiteUrlAlt === undefined) {
      // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = originalSiteUrlAlt;
    }
  });

  it("does not throw when optional site URL is invalid", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_SITE_URL = "your-project-dsn";
    process.env.SITE_URL = "not-a-url";

    expect(() => getEnv()).not.toThrow();
    expect(getEnv().NEXT_PUBLIC_SITE_URL).toBeUndefined();
    expect(getEnv().SITE_URL).toBeUndefined();
  });
});
