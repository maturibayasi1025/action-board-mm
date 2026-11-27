/**
 * @jest-environment node
 */
import { listGlobalUnansweredExclusions } from "@/app/(protected)/admin/_actions/unanswered-global-exclusions";
import { listAwardLateSubmissionGrants } from "@/app/(protected)/admin/award-surveys/[id]/late-grant-actions";
import { listEnpsLateSubmissionGrants } from "@/app/(protected)/admin/enps-surveys/[id]/late-grant-actions";
import {
  getCompanyComparison,
  listReportSurveys,
} from "@/app/(protected)/admin/enps-surveys/reports/actions";
import { createServiceClient } from "@/lib/supabase/server";
import { createFakePostgrest, pad } from "./fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
  createClient: jest.fn(),
}));
jest.mock("@/lib/utils/isOwner", () => ({
  requireOwner: jest.fn(),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const USERS = 1200;
const COMPANIES = 1200;
const OLD_SURVEYS = 600;
const SURVEY_ID = "survey-target";

const userId = (i: number) => `user-${pad(i)}`;
const userName = (i: number) => `社員${pad(i)}`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const CURRENT = { id: "survey-current", year_month: "2100-02" };
const PREVIOUS = { id: "survey-previous", year_month: "2100-01" };
const QUESTION_ID = "question-score";
const companyName = (i: number) => `会社${pad(i)}`;

const oldSurvey = (i: number) => ({
  id: `survey-old-${pad(i)}`,
  year_month: `${1900 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
  title: `旧${i}`,
});

function snapshot(
  id: string,
  surveyId: string,
  scope: "group" | "company",
  company: string,
  npsBase: number,
) {
  return {
    id,
    survey_id: surveyId,
    question_id: QUESTION_ID,
    scope,
    company_name: company,
    business_unit_name: "",
    target_count: 10,
    respondent_count: 10,
    promoters: 5,
    passives: 3,
    detractors: 2,
    nps_respondent_base: npsBase,
    nps_imputed_base: npsBase,
  };
}

function buildTables() {
  const surveyRows = [
    { ...CURRENT, title: "当月" },
    { ...PREVIOUS, title: "前月" },
    ...range(OLD_SURVEYS).map(oldSurvey),
  ];

  const snapshots = [
    ...[CURRENT, PREVIOUS].flatMap((s, k) => [
      snapshot(`snap-${s.id}-group`, s.id, "group", "", 30 + k),
      ...range(COMPANIES).map((i) =>
        snapshot(
          `snap-${s.id}-${pad(i)}`,
          s.id,
          "company",
          companyName(i),
          k === 0 ? 40 : 30,
        ),
      ),
    ]),
    ...range(OLD_SURVEYS).map((i) =>
      snapshot(`snap-old-${pad(i)}`, oldSurvey(i).id, "group", "", 0),
    ),
  ];

  const sameInstant = "2026-10-05T00:00:00.000Z";
  const grants = range(USERS).map((i) => ({
    id: `grant-${pad(i)}`,
    survey_id: SURVEY_ID,
    user_id: userId(i),
    expires_at: "2026-10-12T00:00:00.000Z",
    used_at: null,
    created_at: sameInstant,
  }));

  return {
    enps_surveys: surveyRows,
    enps_questions: [
      {
        id: QUESTION_ID,
        question_text: "おすすめ度",
        display_order: 1,
        is_active: true,
        question_type: "score_0_10",
      },
    ],
    enps_monthly_snapshots: snapshots,
    private_users: range(USERS).map((i) => ({
      id: userId(i),
      name: userName(i),
      suspended_at: null,
    })),
    unanswered_survey_global_exclusions: range(USERS).map((i) => ({
      user_id: userId(i),
    })),
    enps_late_submission_grants: grants,
    award_late_submission_grants: grants,
  };
}

describe("管理画面の一覧は 1000 行を超えても欠けも重複もなく返す", () => {
  beforeEach(() => {
    jest
      .mocked(createServiceClient)
      .mockResolvedValue(
        createFakePostgrest(buildTables()) as Awaited<
          ReturnType<typeof createServiceClient>
        >,
      );
  });

  it("レポート画面のアンケート一覧（スナップショット保存済みの月を新しい順）", async () => {
    const surveys = await listReportSurveys();

    expect(surveys).toHaveLength(OLD_SURVEYS + 2);
    expect(surveys.slice(0, 2).map((s) => s.survey_id)).toEqual([
      CURRENT.id,
      PREVIOUS.id,
    ]);
    const months = surveys.map((s) => s.year_month);
    expect(months).toEqual([...months].sort().reverse());
  });

  it("レポート画面の会社横並び比較（保存済みスナップショット表示）", async () => {
    const result = await getCompanyComparison(CURRENT.id);

    expect(result?.previousSurvey?.survey_id).toBe(PREVIOUS.id);
    const companies = result?.rows.filter((r) => !r.is_group) ?? [];
    expect(companies.map((r) => r.company_name)).toEqual(
      range(COMPANIES).map(companyName),
    );
    for (const row of companies) {
      expect(row.metrics[QUESTION_ID]?.delta_from_previous).toBe(10);
    }
  });

  it("除外設定画面の一覧", async () => {
    const list = await listGlobalUnansweredExclusions();

    expect(list).toEqual(
      range(USERS).map((i) => ({ id: userId(i), name: userName(i) })),
    );
  });

  it.each([
    ["eNPS", listEnpsLateSubmissionGrants],
    ["表彰", listAwardLateSubmissionGrants],
  ] as const)("期限後付与の一覧と名前表示（%s）", async (_label, list) => {
    const grants = await list(SURVEY_ID);

    expect(grants.map((g) => g.id).sort()).toEqual(
      range(USERS).map((i) => `grant-${pad(i)}`),
    );
    for (const grant of grants) {
      expect(grant.user_name).toBe(userName(Number(grant.user_id.slice(5))));
    }
  });
});
