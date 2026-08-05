import {
  type CompanyComparisonRow,
  GROUP_REPORT_SLUG,
  type QuestionMetric,
} from "@/lib/admin/enps-report/comparison";
import {
  deltaToneClass,
  formatMetricDelta,
  formatMetricNps,
  formatResponseRate,
  gapToneClass,
} from "@/lib/admin/enps-report/format";
import Link from "next/link";
import { Fragment } from "react";

type Question = { id: string; question_text: string };

function MetricCells({ metric }: { metric: QuestionMetric | undefined }) {
  return (
    <>
      <td className="py-2 px-3 text-right font-semibold tabular-nums">
        <span className={gapToneClass(metric?.delta_from_group ?? null)}>
          {formatMetricNps(metric)}
        </span>
      </td>
      <td
        className={`py-2 px-3 text-right tabular-nums ${deltaToneClass(
          metric?.masked ? null : (metric?.delta_from_previous ?? null),
        )}`}
      >
        {formatMetricDelta(metric)}
      </td>
      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
        {!metric || metric.masked
          ? formatResponseRate(null)
          : formatResponseRate(metric.response_rate)}
      </td>
    </>
  );
}

export function CompanyComparisonTable({
  rows,
  questions,
  surveyId,
}: {
  rows: CompanyComparisonRow[];
  questions: Question[];
  surveyId: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        この月のスナップショットにデータがありません。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th
              scope="col"
              rowSpan={2}
              className="sticky left-0 z-[1] bg-muted/95 py-2.5 px-3 text-left font-medium min-w-[12rem] whitespace-nowrap backdrop-blur-sm"
            >
              会社
            </th>
            {questions.map((q) => (
              <th
                key={q.id}
                scope="colgroup"
                colSpan={3}
                className="py-2 px-3 text-center font-medium border-l border-border"
                title={q.question_text}
              >
                <span className="line-clamp-1">{q.question_text}</span>
              </th>
            ))}
          </tr>
          <tr className="border-b border-border bg-muted/30 text-xs">
            {questions.map((q) => (
              <Fragment key={q.id}>
                <th
                  scope="col"
                  className="py-2 px-3 text-right font-medium border-l border-border whitespace-nowrap"
                >
                  eNPS
                </th>
                <th
                  scope="col"
                  className="py-2 px-3 text-right font-medium whitespace-nowrap"
                >
                  前月差
                </th>
                <th
                  scope="col"
                  className="py-2 px-3 text-right font-medium whitespace-nowrap"
                >
                  回答率
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={row.company_name}
              className={row.is_group ? "bg-muted/40 font-medium" : ""}
            >
              <td className="sticky left-0 z-[1] bg-background py-2 px-3 whitespace-nowrap">
                {row.is_group ? (
                  <Link
                    href={`/admin/enps-surveys/reports/${GROUP_REPORT_SLUG}?survey=${surveyId}`}
                    className="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    {row.company_name}
                  </Link>
                ) : (
                  <Link
                    href={`/admin/enps-surveys/reports/${encodeURIComponent(
                      row.company_name,
                    )}?survey=${surveyId}`}
                    className="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    {row.company_name}
                  </Link>
                )}
              </td>
              {questions.map((q) => (
                <MetricCells key={q.id} metric={row.metrics[q.id]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
