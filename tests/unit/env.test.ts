import { getSiteUrl } from "@/lib/env";

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
