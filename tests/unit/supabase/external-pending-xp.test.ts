/**
 * @jest-environment node
 */
import { claimExternalPendingXp } from "@/lib/services/external-pending-xp";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

const PENDING = 1200;
const EXTERNAL_NAME = "社外のかた";
const NEW_USER_ID = "user-new";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("登録時の社外称賛の保留ポイント", () => {
  function buildTables() {
    return {
      external_user_pending_xp: [
        ...range(PENDING).map((i) => ({
          id: `pending-${pad(i)}`,
          external_user_name: EXTERNAL_NAME,
          user_mission_id: `user-mission-${pad(i)}`,
          xp_amount: 5,
          description: null,
          claimed_at: null,
          claimed_by_user_id: null,
        })),
        {
          id: "pending-claimed",
          external_user_name: EXTERNAL_NAME,
          user_mission_id: "user-mission-claimed",
          xp_amount: 5,
          description: null,
          claimed_at: "2026-01-01T00:00:00.000Z",
          claimed_by_user_id: "user-earlier",
        },
      ],
      xp_transactions: [] as Record<string, unknown>[],
    };
  }

  it(`未付与が ${PENDING} 件あっても、全件を付与して付与済みにする`, async () => {
    const tables = buildTables();
    const claimed = await claimExternalPendingXp(
      createFakePostgrest(tables),
      NEW_USER_ID,
      EXTERNAL_NAME,
    );

    expect(claimed).toBe(PENDING);
    expect(tables.xp_transactions).toHaveLength(PENDING);
    expect(new Set(tables.xp_transactions.map((tx) => tx.source_id)).size).toBe(
      PENDING,
    );
    expect(
      tables.external_user_pending_xp
        .filter((row) => row.id !== "pending-claimed")
        .every((row) => row.claimed_by_user_id === NEW_USER_ID),
    ).toBe(true);
    expect(
      tables.external_user_pending_xp.find(
        (row) => row.id === "pending-claimed",
      )?.claimed_by_user_id,
    ).toBe("user-earlier");
  });

  it("保留ポイントの取得に失敗したら、何も付与せず例外にする", async () => {
    const tables = buildTables();
    await expect(
      claimExternalPendingXp(
        createFakePostgrest(tables, {
          failingTables: ["external_user_pending_xp"],
        }),
        NEW_USER_ID,
        EXTERNAL_NAME,
      ),
    ).rejects.toThrow("connection error");
    expect(tables.xp_transactions).toHaveLength(0);
  });
});
