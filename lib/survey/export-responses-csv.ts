/**
 * アンケート個別回答（点数・コメント）を、1人1行の CSV にする。
 * Excel / Google スプレッドシートに貼れるよう UTF-8 BOM 付きも出せる。
 */

import {
  type AdminSurveyResponseRow,
  compareGroupedRespondents,
  dedupeSurveyResponsesLatestPerQuestion,
  groupDedupedResponsesByUser,
} from "@/lib/admin/group-survey-responses";

export type SurveyExportQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  display_order: number;
  /** 列見出し。未指定なら question_text */
  header?: string;
  question_group?: string | null;
};

export type SurveyExportAnswer = AdminSurveyResponseRow;

export function escapeSurveyCsvCell(value: string | number | null): string {
  const str = value === null ? "" : String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatSurveyCsvAnswerCell(
  question: SurveyExportQuestion,
  row: SurveyExportAnswer | undefined,
): string {
  if (!row) {
    return "";
  }
  if (question.question_type === "score_0_10") {
    return row.score_value === null ? "" : String(row.score_value);
  }
  if (question.question_type === "user_select") {
    const name = row.nominee_user_name?.trim() ?? "";
    const text = row.text_value?.trim() ?? "";
    if (name && text) {
      return `${name}\n${text}`;
    }
    return name || text;
  }
  return row.text_value?.trim() ?? "";
}

function uniqueQuestionHeaders(questions: SurveyExportQuestion[]): string[] {
  const seen = new Map<string, number>();
  return questions.map((question) => {
    const base = question.header?.trim() || question.question_text;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function lateLabel(byQuestionId: Record<string, SurveyExportAnswer>): string {
  return Object.values(byQuestionId).some((row) => row.is_late_submission)
    ? "期限後"
    : "";
}

export function buildSurveyResponsesCsv(input: {
  questions: SurveyExportQuestion[];
  responses: SurveyExportAnswer[];
}): { lines: string[]; rowCount: number } {
  const questions = [...input.questions].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const headers = [
    "氏名",
    "会社",
    "事業部",
    "期限後",
    ...uniqueQuestionHeaders(questions),
  ];
  const grouped = groupDedupedResponsesByUser(
    dedupeSurveyResponsesLatestPerQuestion(input.responses),
  ).sort((a, b) => compareGroupedRespondents(a, b, "name"));

  const dataLines = grouped.map((user) => {
    const cells = [
      user.userName,
      user.company_name,
      user.business_unit_name,
      lateLabel(user.byQuestionId),
      ...questions.map((question) =>
        formatSurveyCsvAnswerCell(question, user.byQuestionId[question.id]),
      ),
    ];
    return cells.map(escapeSurveyCsvCell).join(",");
  });

  return {
    lines: [headers.map(escapeSurveyCsvCell).join(","), ...dataLines],
    rowCount: grouped.length,
  };
}

export function surveyResponsesCsvText(
  lines: string[],
  options?: { bom?: boolean },
): string {
  const body = `${lines.join("\n")}\n`;
  return options?.bom ? `\uFEFF${body}` : body;
}

export function surveyResponsesCsvFilename(
  kind: "enps" | "award",
  yearMonth: string,
): string {
  const prefix = kind === "enps" ? "eNPS回答" : "表彰回答";
  return `${prefix}_${yearMonth}.csv`;
}
