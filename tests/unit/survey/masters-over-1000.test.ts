/**
 * @jest-environment node
 */
import { getAwardQuestions } from "@/app/(protected)/admin/award-surveys/questions/actions";
import { listCompaniesAndUnits } from "@/app/(protected)/admin/business-units/actions";
import { getQuestions } from "@/app/(protected)/admin/enps-surveys/questions/actions";
import { getActiveScoreQuestions } from "@/app/(protected)/admin/enps-surveys/trends/actions";
import { getAllMissions } from "@/app/(protected)/admin/important-missions/actions";
import { createServiceClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/utils/isOwner";
import { createFakePostgrest, pad } from "./fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/utils/isOwner", () => ({
  requireOwner: jest.fn(),
  isOwner: jest.fn(async () => true),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const TOTAL = 1200;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

// 表示順はすべて同じ値にして、一意キーの並びがないとページの境目で欠けるようにする
function buildTables() {
  return {
    enps_questions: range(TOTAL).map((i) => ({
      id: `q-${pad(i)}`,
      question_text: `設問${i}`,
      question_type: "score_0_10",
      display_order: 1,
      is_active: true,
    })),
    award_questions: range(TOTAL).map((i) => ({
      id: `a-${pad(i)}`,
      question_text: `表彰設問${i}`,
      question_type: "text",
      question_group: "team_value",
      display_order: 1,
      is_active: true,
    })),
    companies: range(TOTAL).map((i) => ({
      id: `c-${pad(i)}`,
      name: `会社${i}`,
      display_order: 1,
      is_active: true,
    })),
    business_units: range(TOTAL).map((i) => ({
      id: `b-${pad(i)}`,
      company_id: `c-${pad(i)}`,
      name: `事業部${i}`,
      display_order: 1,
      is_active: true,
    })),
    missions: range(TOTAL).map((i) => ({
      id: `m-${pad(i)}`,
      title: "同名のグッジョブ",
      is_hidden: false,
    })),
  };
}

const expectAllUnique = (ids: string[], prefix: string) => {
  expect(ids).toHaveLength(TOTAL);
  expect(new Set(ids).size).toBe(TOTAL);
  expect([...ids].sort()).toEqual(
    range(TOTAL).map((i) => `${prefix}${pad(i)}`),
  );
};

describe("マスタが 1000 件を超えても欠けも重複もなく返す", () => {
  beforeEach(() => {
    jest.mocked(isOwner).mockResolvedValue(true);
    jest
      .mocked(createServiceClient)
      .mockResolvedValue(
        createFakePostgrest(buildTables()) as Awaited<
          ReturnType<typeof createServiceClient>
        >,
      );
  });

  it("eNPS 設問の管理一覧", async () => {
    expectAllUnique(
      (await getQuestions()).map((q) => q.id),
      "q-",
    );
  });

  it("eNPS 推移のスコア設問", async () => {
    expectAllUnique(
      (await getActiveScoreQuestions()).map((q) => q.id),
      "q-",
    );
  });

  it("表彰設問の管理一覧", async () => {
    expectAllUnique(
      (await getAwardQuestions()).map((q) => q.id),
      "a-",
    );
  });

  it("会社と事業部の管理一覧", async () => {
    const result = await listCompaniesAndUnits();
    if (!result.success) throw new Error(result.error);
    expectAllUnique(
      result.companies.map((c) => c.id),
      "c-",
    );
    expectAllUnique(
      result.units.map((u) => u.id),
      "b-",
    );
  });

  it("重要グッジョブ設定のグッジョブ選択肢", async () => {
    const result = await getAllMissions();
    if (!result.success || !result.data) throw new Error(result.error);
    expectAllUnique(
      result.data.map((m) => m.id),
      "m-",
    );
  });
});
