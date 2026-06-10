export const SELF_EVAL_QUESTION_IDS = {
  passionate_execution: "ae000001-0000-0000-0000-000000000001",
  supreme_relations: "ae000002-0000-0000-0000-000000000001",
  happiness_cycle: "ae000003-0000-0000-0000-000000000001",
} as const;

export type ValueKey = keyof typeof SELF_EVAL_QUESTION_IDS;

export const VALUE_LABELS: Record<ValueKey, string> = {
  passionate_execution: "夢中になってやり切る",
  supreme_relations: "至高な人間関係を",
  happiness_cycle: "幸せの循環",
};

export const VALUE_ORDER: ValueKey[] = [
  "passionate_execution",
  "supreme_relations",
  "happiness_cycle",
];

export type SurveyRow = { id: string; year_month: string; title: string };

export function parseMonthsArg(argv: string[]): string[] | null {
  const arg = argv.find((a) => a.startsWith("--months="));
  if (!arg) return null;
  const raw = arg.slice("--months=".length).trim();
  if (!raw) {
    throw new Error(
      "--months= に対象年月を指定してください（例: 2026-03,2026-04,2026-05）",
    );
  }
  const months = raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  for (const month of months) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error(
        `不正な年月形式: ${month}（YYYY-MM 形式で指定してください）`,
      );
    }
  }
  return months;
}

export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCsvRow(fields: string[]): string {
  return `${fields.map(escapeCsvField).join(",")}\n`;
}

export function buildValueCell(
  userId: string,
  valueKey: ValueKey,
  surveys: SurveyRow[],
  surveyIdToYearMonth: Map<string, string>,
  responseIndex: Map<string, string>,
): string {
  const parts: string[] = [];
  const questionId = SELF_EVAL_QUESTION_IDS[valueKey];

  for (const survey of surveys) {
    const key = `${userId}:${survey.id}:${questionId}`;
    const text = responseIndex.get(key);
    if (!text) continue;
    const yearMonth = surveyIdToYearMonth.get(survey.id) ?? survey.year_month;
    parts.push(`【${yearMonth}】${text}`);
  }

  return parts.join("\n");
}

export function buildMonthRangeLabel(surveys: SurveyRow[]): string {
  if (surveys.length === 1) return surveys[0].year_month;
  return `${surveys[0].year_month}_to_${surveys[surveys.length - 1].year_month}`;
}

export function buildCsvContent(headers: string[], rows: string[][]): string {
  const lines = [
    serializeCsvRow(headers).trimEnd(),
    ...rows.map((fields) => serializeCsvRow(fields).trimEnd()),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}
