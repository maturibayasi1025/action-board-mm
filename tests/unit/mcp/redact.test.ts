import { pickAllowlisted, stripForbiddenKeys } from "@/lib/mcp/redact";

describe("pickAllowlisted", () => {
  it("keeps allowed columns and drops slack_user_id even if listed", () => {
    const row = {
      id: "u1",
      name: "A",
      slack_user_id: "U123",
      date_of_birth: "1990-01-01",
    };
    expect(
      pickAllowlisted(row, ["id", "name", "slack_user_id", "date_of_birth"]),
    ).toEqual({ id: "u1", name: "A" });
  });

  it("keeps slack_user_id when explicitly allowed", () => {
    const row = {
      id: "u1",
      name: "A",
      slack_user_id: "U123",
      date_of_birth: "1990-01-01",
    };
    expect(
      pickAllowlisted(row, ["id", "name", "slack_user_id", "date_of_birth"], {
        allowSlackUserId: true,
      }),
    ).toEqual({ id: "u1", name: "A", slack_user_id: "U123" });
  });
});

describe("stripForbiddenKeys", () => {
  it("recursively removes forbidden keys", () => {
    const payload = {
      items: [
        {
          name: "A",
          email: "a@example.com",
          nested: { slack_user_id: "U1", ok: true },
        },
      ],
      hubspot_contact_id: "hs",
    };
    expect(stripForbiddenKeys(payload)).toEqual({
      items: [{ name: "A", nested: { ok: true } }],
    });
  });

  it("keeps slack_user_id only when allowed and still drops email and DOB", () => {
    const payload = {
      items: [
        {
          name: "A",
          email: "a@example.com",
          slack_user_id: "U1",
          date_of_birth: "1990-01-01",
        },
      ],
    };
    expect(stripForbiddenKeys(payload, { allowSlackUserId: true })).toEqual({
      items: [{ name: "A", slack_user_id: "U1" }],
    });
  });
});
