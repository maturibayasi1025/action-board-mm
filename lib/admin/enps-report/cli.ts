/**
 * レポート生成バッチの引数解釈と対象サーベイの選択。
 * スクリプト本体から切り出してテストできるようにしている。
 */

import type { SurveyForSnapshot } from "@/lib/admin/enps-report/build-and-store";
import { isEnpsSurveyEnded } from "@/lib/admin/enps-unanswered-imputation";

export type ReportCliOptions = {
  yearMonth: string | null;
  force: boolean;
  all: boolean;
  skipAi: boolean;
};

export function parseReportCliOptions(argv: string[]): ReportCliOptions {
  const options: ReportCliOptions = {
    yearMonth: null,
    force: false,
    all: false,
    skipAi: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") {
      options.force = true;
    } else if (arg === "--all") {
      options.all = true;
    } else if (arg === "--skip-ai") {
      options.skipAi = true;
    } else if (arg === "--year-month") {
      options.yearMonth = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--year-month=")) {
      options.yearMonth = arg.slice("--year-month=".length);
    }
  }

  if (options.yearMonth && !/^\d{4}-\d{2}$/.test(options.yearMonth)) {
    throw new Error(
      `--year-month は YYYY-MM 形式で指定してください: ${options.yearMonth}`,
    );
  }

  return options;
}

/**
 * 指定がなければ「締切済みで最も新しい 1 件」を対象にする。
 * 月初に実行すると前月分（月末締切）が確定する。
 */
export function selectTargetSurveys(
  surveys: SurveyForSnapshot[],
  options: Pick<ReportCliOptions, "all" | "yearMonth">,
  now: Date,
): SurveyForSnapshot[] {
  if (options.all) {
    return surveys;
  }

  if (options.yearMonth) {
    return surveys.filter((s) => s.year_month === options.yearMonth);
  }

  const ended = surveys.filter((s) => isEnpsSurveyEnded(s.end_date, now));
  if (ended.length === 0) {
    return [];
  }

  return [
    ended.reduce((acc, s) =>
      new Date(s.end_date).getTime() > new Date(acc.end_date).getTime()
        ? s
        : acc,
    ),
  ];
}
