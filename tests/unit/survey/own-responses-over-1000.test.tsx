import EnpsSurveyLatePage from "@/app/(protected)/surveys/[id]/late/page";
import SurveyPage from "@/app/(protected)/surveys/[id]/page";
import AwardSurveyLatePage from "@/app/(protected)/surveys/award/[id]/late/page";
import AwardSurveyPage from "@/app/(protected)/surveys/award/[id]/page";
import { createClient } from "@/lib/supabase/server";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { createFakePostgrest, pad } from "./fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/survey/validate-late-grant-service", () => ({
  validateEnpsLateGrantAccess: async () => true,
  validateAwardLateGrantAccess: async () => true,
}));
jest.mock("@/app/(protected)/surveys/_lib/linked-post-mission", () => ({
  getLinkedPostMissionContext: async () => null,
}));

type Responses = Record<string, Record<string, unknown>>;
const formMock = ({
  existingResponses,
  isFirstTimeResponse,
}: {
  existingResponses: Responses;
  isFirstTimeResponse: boolean;
}) => (
  <div
    data-testid="form"
    data-count={Object.keys(existingResponses).length}
    data-first={String(isFirstTimeResponse)}
    data-sample={JSON.stringify(existingResponses["question-1199"] ?? null)}
  />
);
jest.mock(
  "@/app/(protected)/surveys/[id]/_components/survey-form-client",
  () => ({
    SurveyFormClient: (props: Parameters<typeof formMock>[0]) =>
      formMock(props),
  }),
);
jest.mock(
  "@/app/(protected)/surveys/award/[id]/_components/award-survey-form-client",
  () => ({
    AwardSurveyFormClient: (props: Parameters<typeof formMock>[0]) =>
      formMock(props),
  }),
);

const USER_ID = "user-0001";
const OTHER_USER_ID = "user-0002";
const SURVEY_ID = "survey-0001";
const QUESTIONS = 1200;
const LOAD_ERROR = "回答の取得に失敗しました";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const questionId = (i: number) => `question-${pad(i)}`;
const survey = {
  id: SURVEY_ID,
  title: "アンケート",
  description: null,
  start_date: "2020-01-01T00:00:00.000Z",
  end_date: "2999-12-31T00:00:00.000Z",
  is_active: true,
};
const questions = range(QUESTIONS).map((i) => ({
  id: questionId(i),
  question_text: `設問${i}`,
  display_order: 1,
  is_active: true,
}));

function enpsTables() {
  return {
    enps_surveys: [survey],
    enps_questions: questions,
    enps_responses: [
      ...range(QUESTIONS).map((i) => ({
        id: `response-${pad(i)}`,
        survey_id: SURVEY_ID,
        user_id: USER_ID,
        question_id: questionId(i),
        score_value: i % 11,
        text_value: null,
      })),
      ...range(100).map((i) => ({
        id: `other-${pad(i)}`,
        survey_id: SURVEY_ID,
        user_id: OTHER_USER_ID,
        question_id: questionId(i),
        score_value: 0,
        text_value: null,
      })),
    ],
  };
}

function awardTables() {
  return {
    award_surveys: [survey],
    award_questions: questions,
    public_user_profiles: [{ id: USER_ID, name: "回答者" }],
    award_responses: [
      ...range(QUESTIONS).map((i) => ({
        id: `response-${pad(i)}`,
        survey_id: SURVEY_ID,
        user_id: USER_ID,
        question_id: questionId(i),
        text_value: `回答${i}`,
        nominee_user_id: null,
      })),
      ...range(100).map((i) => ({
        id: `other-${pad(i)}`,
        survey_id: SURVEY_ID,
        user_id: OTHER_USER_ID,
        question_id: questionId(i),
        text_value: "他人",
        nominee_user_id: null,
      })),
    ],
  };
}

const KINDS = [
  {
    name: "eNPS",
    tables: enpsTables,
    responses: "enps_responses",
    Page: SurveyPage,
    LatePage: EnpsSurveyLatePage,
    sample: {
      question_id: questionId(1199),
      score_value: 1199 % 11,
      text_value: null,
    },
  },
  {
    name: "表彰",
    tables: awardTables,
    responses: "award_responses",
    Page: AwardSurveyPage,
    LatePage: AwardSurveyLatePage,
    sample: {
      question_id: questionId(1199),
      text_value: "回答1199",
      nominee_user_id: null,
    },
  },
];

function useTables(
  tables: Record<string, Record<string, unknown>[]>,
  options?: Parameters<typeof createFakePostgrest>[1],
) {
  jest
    .mocked(createClient)
    .mockResolvedValue(
      createFakePostgrest(tables, { authUserId: USER_ID, ...options }),
    );
}

const params = Promise.resolve({ id: SURVEY_ID });
const lateSearchParams = Promise.resolve({ g: "grant", t: "token" });

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(KINDS)(
  "$name の本人の既存回答が 1200 設問分あるとき",
  ({ tables, responses, Page, LatePage, sample }) => {
    it("通常画面は、全設問の既存回答をフォームに渡し、回答済みとして出す", async () => {
      useTables(tables());
      render((await Page({ params })) as ReactElement);
      const form = screen.getByTestId("form");
      expect(form.dataset.count).toBe(String(QUESTIONS));
      expect(form.dataset.first).toBe("false");
      expect(JSON.parse(form.dataset.sample ?? "null")).toEqual(sample);
      expect(screen.getByText("回答済み")).toBeInTheDocument();
    });

    it("期限後画面は、回答済みとして出し、回答フォームを出し直さない", async () => {
      useTables(tables());
      render(
        (await LatePage({
          params,
          searchParams: lateSearchParams,
        })) as ReactElement,
      );
      expect(
        screen.getByText("すでにこのアンケートに回答済みです。"),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("form")).not.toBeInTheDocument();
    });

    it("通常画面は、回答の取得に失敗したら空のフォームを出さず、その場に失敗を出す", async () => {
      useTables(tables(), { failingTables: [responses] });
      render((await Page({ params })) as ReactElement);
      expect(screen.getByRole("alert")).toHaveTextContent(LOAD_ERROR);
      expect(screen.queryByTestId("form")).not.toBeInTheDocument();
      expect(screen.getByText("アンケート")).toBeInTheDocument();
    });

    it("期限後画面は、回答の取得に失敗したら回答フォームを出さず、その場に失敗を出す", async () => {
      useTables(tables(), { failingTables: [responses] });
      render(
        (await LatePage({
          params,
          searchParams: lateSearchParams,
        })) as ReactElement,
      );
      expect(screen.getByRole("alert")).toHaveTextContent(LOAD_ERROR);
      expect(screen.queryByTestId("form")).not.toBeInTheDocument();
    });
  },
);
