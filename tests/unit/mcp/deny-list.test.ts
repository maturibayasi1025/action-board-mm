import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NEVER_REGISTERED_TOOL_NAMES } from "@/lib/mcp/forbidden-tools";
import { MCP_TOOLS } from "@/lib/mcp/tools";

const TOOLS_DIR = join(process.cwd(), "lib/mcp/tools");
const PRIVILEGED_PATH = join(process.cwd(), "lib/mcp/privileged-client.ts");
const PUBLIC_TOOL_FILES = [
  "missions.ts",
  "profiles.ts",
  "rankings.ts",
  "user-missions.ts",
  "types.ts",
];

const FORBIDDEN_TABLES = [
  "enps_responses",
  "award_responses",
  "enps_report_ai_summaries",
  "user_referral",
  "mission_artifacts",
  "slack_notifications",
];

describe("MCP deny list", () => {
  it("does not query forbidden tables from public tool modules", () => {
    const combined = PUBLIC_TOOL_FILES.map((name) =>
      readFileSync(join(TOOLS_DIR, name), "utf8"),
    ).join("\n");
    for (const table of FORBIDDEN_TABLES) {
      expect(combined).not.toContain(`"${table}"`);
      expect(combined).not.toContain(`from("${table}")`);
    }
    expect(combined).not.toContain("private_users");
    expect(combined).not.toContain("execute_sql");
    expect(combined).not.toContain("createServiceClient");
    expect(combined).not.toContain("privileged-client");
  });

  it("keeps privileged queries column-fixed", () => {
    const source = readFileSync(PRIVILEGED_PATH, "utf8");
    expect(source).not.toContain('select("*")');
    expect(source).not.toContain("select('*')");
    expect(source).toContain(
      'export const PRIVATE_USERS_SLACK_SELECT = "id, slack_user_id"',
    );
    expect(source).not.toContain("date_of_birth");
    expect(source).not.toContain("hubspot_contact_id");
    expect(source).not.toContain("enps_report_ai_summaries");
    expect(source).not.toContain("replace_enps_responses");
    expect(source).not.toContain("replace_award_responses");
    expect(source).not.toContain("execute_sql");
  });

  it("does not expose generic from() from privileged-client", () => {
    const source = readFileSync(PRIVILEGED_PATH, "utf8");
    expect(source).not.toMatch(/export function createPrivileged/);
    expect(source).not.toMatch(/export \{[^}]*createPrivilegedDb/);
  });

  it("does not register write or SQL tools", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    for (const forbidden of NEVER_REGISTERED_TOOL_NAMES) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("does not mention forbidden tables as string literals in tool modules except via privileged helpers", () => {
    const files = readdirSync(TOOLS_DIR).filter(
      (name) => name.endsWith(".ts") && name !== "index.ts",
    );
    const combined = files
      .map((name) => readFileSync(join(TOOLS_DIR, name), "utf8"))
      .join("\n");
    expect(combined).not.toContain('from("enps_responses")');
    expect(combined).not.toContain('from("award_responses")');
    expect(combined).not.toContain('from("private_users")');
    expect(combined).not.toContain("createServiceClient");
  });
});
