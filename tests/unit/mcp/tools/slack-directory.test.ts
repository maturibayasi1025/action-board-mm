import {
  getSlackUserIdTool,
  listSlackDirectoryTool,
} from "@/lib/mcp/tools/slack-directory";

jest.mock("@/lib/mcp/privileged-client", () => ({
  listSlackDirectory: jest.fn(async () => ({
    items: [{ user_id: "u1", name: "A", slack_user_id: "U123" }],
    limit: 20,
    offset: 0,
  })),
  getSlackDirectoryEntry: jest.fn(async () => ({
    user_id: "u1",
    name: "A",
    slack_user_id: "U123",
  })),
}));

const principal = {
  keyId: "google:owner@maisonmarc.com",
  scopes: ["slack_directory"] as const,
  label: "owner@maisonmarc.com",
  email: "owner@maisonmarc.com",
};

describe("list_slack_directory", () => {
  it("returns slack ids from the privileged helper", async () => {
    const result = (await listSlackDirectoryTool.execute(
      {},
      { db: {} as never, principal },
    )) as { items: Array<{ slack_user_id: string }> };
    expect(result.items[0]?.slack_user_id).toBe("U123");
  });

  it("marks the tool as slack-id allowlisted", () => {
    expect(listSlackDirectoryTool.allowSlackUserId).toBe(true);
    expect(getSlackUserIdTool.allowSlackUserId).toBe(true);
  });
});
