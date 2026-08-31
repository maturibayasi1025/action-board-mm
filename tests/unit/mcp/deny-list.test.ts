import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TOOLS_DIR = join(process.cwd(), "lib/mcp/tools");

const FORBIDDEN_TABLES = [
  "enps_responses",
  "award_responses",
  "enps_report_ai_summaries",
  "user_referral",
  "mission_artifacts",
  "slack_notifications",
];

describe("MCP Phase 1 deny list", () => {
  it("does not query forbidden tables from tool modules", () => {
    const files = readdirSync(TOOLS_DIR).filter(
      (name) => name.endsWith(".ts") && name !== "index.ts",
    );
    const combined = files
      .map((name) => readFileSync(join(TOOLS_DIR, name), "utf8"))
      .join("\n");
    for (const table of FORBIDDEN_TABLES) {
      expect(combined).not.toContain(`"${table}"`);
      expect(combined).not.toContain(`from("${table}")`);
    }
    expect(combined).not.toContain("private_users");
    expect(combined).not.toContain("execute_sql");
    expect(combined).not.toContain("createServiceClient");
  });
});
