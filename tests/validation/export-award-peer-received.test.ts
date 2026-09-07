import {
  type PeerMasterQuestion,
  type PeerResponseRow,
  type PeerSurveyRow,
  type PeerUserRow,
  aggregatePeerReceivedRows,
  awardH1FilenameLabel,
  awardQuarterFilenameLabel,
  buildPeerReceivedCsvContent,
  buildPeerReceivedDetailCsvContent,
  buildPeerReceivedDetailRows,
  collectPeerNominationEvents,
  formatReceivedCommentLine,
  pickReasonQuestionForGroup,
  resolveNomineeFromResponse,
} from "@/lib/admin/export-award-peer-received";
import {
  buildAwardQuarterSummaryCsvContent,
  mergeAwardQuarterSummaryRows,
} from "@/lib/admin/export-award-quarter-summary";
import type { AwardSelfEvalPersonRow } from "@/lib/admin/export-award-self-eval-data";
import { pickNominationQuestionForGroup } from "@/lib/mcp/award-nomination-ranking";

const questions: PeerMasterQuestion[] = [
  {
    id: "self-p",
    question_text: "自己評価",
    question_type: "textarea",
    question_group: "passionate_execution",
    display_order: 1,
    is_active: true,
  },
  {
    id: "nom-p",
    question_text: "夢中指名",
    question_type: "user_select",
    question_group: "passionate_execution",
    display_order: 2,
    is_active: true,
  },
  {
    id: "reason-p",
    question_text: "夢中理由",
    question_type: "textarea",
    question_group: "passionate_execution",
    display_order: 3,
    is_active: true,
  },
  {
    id: "nom-s",
    question_text: "至高指名",
    question_type: "user_select",
    question_group: "supreme_relations",
    display_order: 5,
    is_active: true,
  },
  {
    id: "reason-s",
    question_text: "至高理由",
    question_type: "textarea",
    question_group: "supreme_relations",
    display_order: 6,
    is_active: true,
  },
  {
    id: "nom-h",
    question_text: "幸せ指名",
    question_type: "user_select",
    question_group: "happiness_cycle",
    display_order: 8,
    is_active: true,
  },
  {
    id: "reason-h",
    question_text: "幸せ理由",
    question_type: "textarea",
    question_group: "happiness_cycle",
    display_order: 9,
    is_active: true,
  },
  {
    id: "self-t",
    question_text: "自チーム",
    question_type: "textarea",
    question_group: "team_value",
    display_order: 10,
    is_active: true,
  },
  {
    id: "nom-t",
    question_text: "他チーム",
    question_type: "text",
    question_group: "team_value",
    display_order: 11,
    is_active: true,
  },
  {
    id: "reason-t",
    question_text: "チーム理由",
    question_type: "textarea",
    question_group: "team_value",
    display_order: 12,
    is_active: true,
  },
];

function user(
  id: string,
  name: string,
  opts?: { suspended?: boolean; company?: string; unit?: string },
): PeerUserRow {
  return {
    id,
    name,
    companyName: opts?.company ?? "MAISON MARC",
    businessUnitName: opts?.unit ?? "開発",
    suspended: opts?.suspended ?? false,
  };
}

describe("export-award-peer-received", () => {
  describe("filename labels", () => {
    it("uses Q and Q1Q2 stems", () => {
      expect(awardQuarterFilenameLabel(2026, 2)).toBe("2026-Q2");
      expect(awardH1FilenameLabel(2026)).toBe("2026-Q1Q2");
    });
  });

  describe("pickReasonQuestionForGroup", () => {
    it("picks the textarea after the nomination question, not self-eval", () => {
      const nomination = pickNominationQuestionForGroup(
        questions,
        "passionate_execution",
      );
      expect(nomination?.id).toBe("nom-p");
      expect(
        nomination
          ? pickReasonQuestionForGroup(questions, nomination)?.id
          : undefined,
      ).toBe("reason-p");
    });

    it("picks team reason after the team name text question", () => {
      const nomination = pickNominationQuestionForGroup(
        questions,
        "team_value",
      );
      expect(nomination?.id).toBe("nom-t");
      expect(
        nomination
          ? pickReasonQuestionForGroup(questions, nomination)?.id
          : undefined,
      ).toBe("reason-t");
    });
  });

  describe("resolveNomineeFromResponse", () => {
    const nomination = questions.find((q) => q.id === "nom-p");
    if (!nomination) {
      throw new Error("expected nom-p question");
    }
    const users = new Map([
      ["n1", user("n1", "被推薦者A")],
      ["n2", user("n2", "停止ユーザー", { suspended: true })],
    ]);

    it("resolves user_select nominees and skips suspended users", () => {
      expect(
        resolveNomineeFromResponse(
          {
            survey_id: "s1",
            user_id: "r1",
            question_id: "nom-p",
            text_value: null,
            nominee_user_id: "n1",
            is_late_submission: false,
          },
          nomination,
          users,
        ),
      ).toEqual({
        key: "uid:n1",
        name: "被推薦者A",
        nomineeUserId: "n1",
      });

      expect(
        resolveNomineeFromResponse(
          {
            survey_id: "s1",
            user_id: "r1",
            question_id: "nom-p",
            text_value: null,
            nominee_user_id: "n2",
            is_late_submission: false,
          },
          nomination,
          users,
        ),
      ).toBeNull();
    });

    it("keeps unknown user_select nominees as 不明", () => {
      expect(
        resolveNomineeFromResponse(
          {
            survey_id: "s1",
            user_id: "r1",
            question_id: "nom-p",
            text_value: null,
            nominee_user_id: "missing",
            is_late_submission: false,
          },
          nomination,
          users,
        ),
      ).toEqual({
        key: "uid:missing",
        name: "不明",
        nomineeUserId: "missing",
      });
    });
  });

  describe("formatReceivedCommentLine", () => {
    it("joins month, recommender, and comment", () => {
      expect(
        formatReceivedCommentLine("2026-04", "推薦者B", "やり切っていた"),
      ).toBe("【2026-04】推薦者B: やり切っていた");
    });
  });

  describe("collect + aggregate", () => {
    const surveys: PeerSurveyRow[] = [
      { id: "s1", year_month: "2026-03", title: "3月" },
      { id: "s2", year_month: "2026-04", title: "4月" },
    ];
    const users = new Map([
      ["n1", user("n1", "被推薦者A", { unit: "プロダクト" })],
      ["n2", user("n2", "停止ユーザー", { suspended: true })],
      ["r1", user("r1", "推薦者B")],
      ["r2", user("r2", "推薦者C")],
    ]);

    const responses: PeerResponseRow[] = [
      {
        survey_id: "s1",
        user_id: "r1",
        question_id: "nom-p",
        text_value: null,
        nominee_user_id: "n1",
        is_late_submission: false,
      },
      {
        survey_id: "s1",
        user_id: "r1",
        question_id: "reason-p",
        text_value: "3月の夢中",
        nominee_user_id: null,
        is_late_submission: false,
      },
      {
        survey_id: "s2",
        user_id: "r2",
        question_id: "nom-p",
        text_value: null,
        nominee_user_id: "n1",
        is_late_submission: true,
      },
      {
        survey_id: "s2",
        user_id: "r2",
        question_id: "reason-p",
        text_value: "4月の夢中（期限後）",
        nominee_user_id: null,
        is_late_submission: true,
      },
      {
        survey_id: "s1",
        user_id: "r2",
        question_id: "nom-s",
        text_value: null,
        nominee_user_id: "n1",
        is_late_submission: false,
      },
      {
        survey_id: "s1",
        user_id: "r2",
        question_id: "reason-s",
        text_value: "至高だった",
        nominee_user_id: null,
        is_late_submission: false,
      },
      {
        survey_id: "s1",
        user_id: "r1",
        question_id: "nom-p",
        text_value: null,
        nominee_user_id: "n2",
        is_late_submission: false,
      },
      {
        survey_id: "s2",
        user_id: "r1",
        question_id: "nom-t",
        text_value: "プロジェクトX",
        nominee_user_id: null,
        is_late_submission: false,
      },
      {
        survey_id: "s2",
        user_id: "r1",
        question_id: "reason-t",
        text_value: "チームとして体現",
        nominee_user_id: null,
        is_late_submission: false,
      },
    ];

    it("counts votes including late submissions and excludes suspended nominees", () => {
      const events = collectPeerNominationEvents(
        surveys,
        questions,
        responses,
        users,
      );
      expect(events.some((e) => e.nomineeUserId === "n2")).toBe(false);
      expect(events.filter((e) => e.nomineeKey === "uid:n1")).toHaveLength(3);
      expect(events.some((e) => e.isLate)).toBe(true);

      const rows = aggregatePeerReceivedRows(events, users);
      const person = rows.find((row) => row.nomineeUserId === "n1");
      const team = rows.find((row) => row.name === "プロジェクトX");

      expect(person).toMatchObject({
        name: "被推薦者A",
        companyName: "MAISON MARC",
        businessUnitName: "プロダクト",
        totalVotes: 3,
        votesByGroup: {
          passionate_execution: 2,
          supreme_relations: 1,
          happiness_cycle: 0,
          team_value: 0,
        },
      });
      expect(person?.commentsByGroup.passionate_execution).toBe(
        "【2026-03】推薦者B: 3月の夢中\n【2026-04】推薦者C: 4月の夢中（期限後）",
      );
      expect(person?.commentsByGroup.supreme_relations).toBe(
        "【2026-03】推薦者C: 至高だった",
      );
      expect(team?.totalVotes).toBe(1);
      expect(team?.votesByGroup.team_value).toBe(1);
    });

    it("builds BOM CSV with escaped comments and late flags in the detail file", () => {
      const events = collectPeerNominationEvents(
        surveys,
        questions,
        responses,
        users,
      );
      const rows = aggregatePeerReceivedRows(events, users);
      const csv = buildPeerReceivedCsvContent(rows);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain(
        "氏名,会社,部署,総票数,夢中票,至高票,幸せ票,チーム票",
      );
      expect(csv).toContain("被推薦者A,MAISON MARC,プロダクト,3,2,1,0,0");

      const detail = buildPeerReceivedDetailCsvContent(
        buildPeerReceivedDetailRows(events),
      );
      expect(detail).toContain(
        "年月,バリュー,被推薦者,推薦者,コメント,期限後フラグ",
      );
      expect(detail).toContain(
        "2026-04,夢中になってやり切る,被推薦者A,推薦者C,4月の夢中（期限後）,はい",
      );
    });

    it("escapes commas, quotes, and newlines in comment cells", () => {
      const csv = buildPeerReceivedCsvContent([
        {
          nomineeKey: "uid:n1",
          nomineeUserId: "n1",
          name: "被推薦者A",
          companyName: "MAISON MARC",
          businessUnitName: "開発",
          totalVotes: 1,
          votesByGroup: {
            passionate_execution: 1,
            supreme_relations: 0,
            happiness_cycle: 0,
            team_value: 0,
          },
          commentsByGroup: {
            passionate_execution:
              '【2026-03】推薦者B: 言うには "すごい, 本当に"',
            supreme_relations: "",
            happiness_cycle: "",
            team_value: "",
          },
        },
      ]);

      expect(csv).toContain(
        '"【2026-03】推薦者B: 言うには ""すごい, 本当に"""',
      );
    });
  });
});

describe("export-award-quarter-summary", () => {
  it("merges self-eval and received votes by user id", () => {
    const selfEval: AwardSelfEvalPersonRow[] = [
      {
        userId: "n1",
        name: "被推薦者A",
        companyName: "MAISON MARC",
        businessUnitName: "開発",
        valueCells: {
          passionate_execution: "【2026-03】自己夢中",
          supreme_relations: "",
          happiness_cycle: "",
        },
      },
      {
        userId: "only-self",
        name: "自己評価のみ",
        companyName: "MAISON MARC",
        businessUnitName: "営業",
        valueCells: {
          passionate_execution: "【2026-04】営業の自己評価",
          supreme_relations: "",
          happiness_cycle: "",
        },
      },
    ];

    const received = [
      {
        nomineeKey: "uid:n1",
        nomineeUserId: "n1",
        name: "被推薦者A",
        companyName: "MAISON MARC",
        businessUnitName: "プロダクト",
        totalVotes: 2,
        votesByGroup: {
          passionate_execution: 2,
          supreme_relations: 0,
          happiness_cycle: 0,
          team_value: 0,
        },
        commentsByGroup: {
          passionate_execution: "【2026-03】推薦者B: コメント",
          supreme_relations: "",
          happiness_cycle: "",
          team_value: "",
        },
      },
      {
        nomineeKey: "text:プロジェクトX",
        nomineeUserId: null,
        name: "プロジェクトX",
        companyName: "",
        businessUnitName: "",
        totalVotes: 1,
        votesByGroup: {
          passionate_execution: 0,
          supreme_relations: 0,
          happiness_cycle: 0,
          team_value: 1,
        },
        commentsByGroup: {
          passionate_execution: "",
          supreme_relations: "",
          happiness_cycle: "",
          team_value: "【2026-04】推薦者B: チームとして体現",
        },
      },
    ];

    const rows = mergeAwardQuarterSummaryRows(selfEval, received);
    expect(rows[0]?.name).toBe("被推薦者A");
    expect(rows[0]?.totalVotes).toBe(2);
    expect(rows[0]?.selfEval?.valueCells.passionate_execution).toContain(
      "自己夢中",
    );

    const csv = buildAwardQuarterSummaryCsvContent(rows);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("夢中になってやり切る（自己評価）");
    expect(csv).toContain("自己評価のみ");
    expect(csv).toContain("プロジェクトX");
    expect(csv).toContain("【2026-03】自己夢中");
  });
});
