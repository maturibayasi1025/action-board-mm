import {
  evaluateGoogleAccess,
  parseAllowedGoogleDomain,
  parseAllowedGoogleEmails,
} from "@/lib/mcp/google-access";

describe("parseAllowedGoogleEmails", () => {
  it("parses comma-separated emails as public scope", () => {
    expect(
      parseAllowedGoogleEmails("Owner@maisonmarc.com, analyst@maisonmarc.com"),
    ).toEqual([
      { email: "owner@maisonmarc.com", scopes: ["public"] },
      { email: "analyst@maisonmarc.com", scopes: ["public"] },
    ]);
  });

  it("parses JSON with per-user scopes", () => {
    expect(
      parseAllowedGoogleEmails(
        JSON.stringify([
          {
            email: "owner@maisonmarc.com",
            scopes: ["public", "survey_raw", "not-a-scope"],
          },
        ]),
      ),
    ).toEqual([
      { email: "owner@maisonmarc.com", scopes: ["public", "survey_raw"] },
    ]);
  });

  it("returns empty for blank input", () => {
    expect(parseAllowedGoogleEmails(undefined)).toEqual([]);
    expect(parseAllowedGoogleEmails("")).toEqual([]);
  });
});

describe("evaluateGoogleAccess", () => {
  const allowlist = [
    { email: "owner@maisonmarc.com", scopes: ["public"] as const },
  ];

  it("accepts a verified Workspace account on the allowlist", () => {
    expect(
      evaluateGoogleAccess(
        {
          email: "Owner@maisonmarc.com",
          emailVerified: true,
          hostedDomain: "maisonmarc.com",
        },
        { domain: "maisonmarc.com", allowlist: [...allowlist] },
      ),
    ).toEqual({
      ok: true,
      email: "owner@maisonmarc.com",
      scopes: ["public"],
    });
  });

  it("rejects Gmail and other domains", () => {
    expect(
      evaluateGoogleAccess(
        {
          email: "someone@gmail.com",
          emailVerified: true,
          hostedDomain: null,
        },
        { domain: "maisonmarc.com", allowlist: [...allowlist] },
      ).ok,
    ).toBe(false);
  });

  it("rejects company email without Workspace hd", () => {
    const decision = evaluateGoogleAccess(
      {
        email: "owner@maisonmarc.com",
        emailVerified: true,
        hostedDomain: null,
      },
      { domain: "maisonmarc.com", allowlist: [...allowlist] },
    );
    expect(decision).toEqual({ ok: false, reason: "missing_hd" });
  });

  it("rejects empty allowlist even for a valid Workspace user", () => {
    expect(
      evaluateGoogleAccess(
        {
          email: "owner@maisonmarc.com",
          emailVerified: true,
          hostedDomain: "maisonmarc.com",
        },
        { domain: "maisonmarc.com", allowlist: [] },
      ),
    ).toEqual({ ok: false, reason: "allowlist_empty" });
  });

  it("rejects emails not on the allowlist", () => {
    expect(
      evaluateGoogleAccess(
        {
          email: "other@maisonmarc.com",
          emailVerified: true,
          hostedDomain: "maisonmarc.com",
        },
        { domain: "maisonmarc.com", allowlist: [...allowlist] },
      ),
    ).toEqual({ ok: false, reason: "not_allowlisted" });
  });
});

describe("parseAllowedGoogleDomain", () => {
  it("defaults to maisonmarc.com", () => {
    expect(parseAllowedGoogleDomain(undefined)).toBe("maisonmarc.com");
    expect(parseAllowedGoogleDomain(" Example.COM ")).toBe("example.com");
  });
});
