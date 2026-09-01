import {
  canAccessMcpTool,
  canExposeSlackUserId,
  hasAllScopes,
  requiresGoogleIdentity,
} from "@/lib/mcp/scopes";

describe("hasAllScopes", () => {
  it("requires every listed scope", () => {
    expect(hasAllScopes(["public", "survey_agg"], ["survey_agg"])).toBe(true);
    expect(hasAllScopes(["public"], ["survey_agg"])).toBe(false);
  });
});

describe("canAccessMcpTool", () => {
  it("allows survey_agg without Google email", () => {
    expect(
      canAccessMcpTool({ scopes: ["survey_agg"], email: null }, ["survey_agg"]),
    ).toBe(true);
  });

  it("rejects slack_directory and survey_raw without Google email", () => {
    expect(
      canAccessMcpTool({ scopes: ["slack_directory"], email: null }, [
        "slack_directory",
      ]),
    ).toBe(false);
    expect(
      canAccessMcpTool({ scopes: ["survey_raw"], email: null }, ["survey_raw"]),
    ).toBe(false);
  });

  it("allows restricted scopes for a Google principal", () => {
    expect(
      canAccessMcpTool(
        { scopes: ["survey_raw"], email: "owner@maisonmarc.com" },
        ["survey_raw"],
      ),
    ).toBe(true);
    expect(
      canExposeSlackUserId({
        scopes: ["slack_directory"],
        email: "owner@maisonmarc.com",
      }),
    ).toBe(true);
  });

  it("marks only slack_directory and survey_raw as Google-required", () => {
    expect(requiresGoogleIdentity(["survey_agg"])).toBe(false);
    expect(requiresGoogleIdentity(["slack_directory"])).toBe(true);
    expect(requiresGoogleIdentity(["survey_raw"])).toBe(true);
  });
});
