"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type EnpsOrgDrilldownSegment,
  type EnpsOrgDrilldownSourceRow,
  type EnpsOrgNpsRow,
  listOrgBucketDrilldown,
} from "@/lib/admin/enps-nps-by-business-unit";
import { useMemo, useState } from "react";

function cellOrg(value: string): string {
  return value === "" ? "—" : value;
}

function segmentLabel(segment: EnpsOrgDrilldownSegment): string {
  switch (segment) {
    case "promoter":
      return "推奨者（9〜10点）";
    case "passive":
      return "中立者（7〜8点）";
    case "detractor":
      return "批判者（0〜6点）";
    case "all":
      return "全回答者";
    default: {
      const _exhaustive: never = segment;
      return _exhaustive;
    }
  }
}

type DrilldownConfig = {
  questionId: string;
  variant: "on_time" | "late_only";
  rows: EnpsOrgDrilldownSourceRow[];
};

function OrgNpsTable({
  rows,
  drilldown,
}: {
  rows: EnpsOrgNpsRow[];
  drilldown?: DrilldownConfig;
}) {
  const [openDetail, setOpenDetail] = useState<{
    row: EnpsOrgNpsRow;
    segment: EnpsOrgDrilldownSegment;
  } | null>(null);

  const drilldownList = useMemo(() => {
    if (!openDetail || !drilldown) {
      return [];
    }
    return listOrgBucketDrilldown(
      drilldown.rows,
      drilldown.questionId,
      drilldown.variant,
      openDetail.row.company_name,
      openDetail.row.business_unit_name,
      openDetail.segment,
    );
  }, [openDetail, drilldown]);

  const variantLabel =
    drilldown?.variant === "on_time" ? "期限内回答" : "期限後回答（承認済み）";

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        該当する回答がありません。
      </p>
    );
  }

  const CountCell = ({
    row,
    count,
    segment,
    className,
    ariaLabel,
  }: {
    row: EnpsOrgNpsRow;
    count: number;
    segment: EnpsOrgDrilldownSegment;
    className: string;
    ariaLabel: string;
  }) => {
    if (!drilldown || count <= 0) {
      return <span className={className}>{count}</span>;
    }
    return (
      <button
        type="button"
        className={`${className} cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 text-right underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        onClick={() => setOpenDetail({ row, segment })}
        aria-label={ariaLabel}
      >
        {count}
      </button>
    );
  };

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th
                scope="col"
                className="py-2.5 px-3 text-left font-medium whitespace-nowrap"
              >
                会社
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-left font-medium whitespace-nowrap"
              >
                事業部
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium tabular-nums whitespace-nowrap"
              >
                回答者数
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium tabular-nums whitespace-nowrap"
              >
                NPS
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium text-green-700 tabular-nums whitespace-nowrap"
              >
                推奨
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium text-yellow-700 tabular-nums whitespace-nowrap"
              >
                中立
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium text-red-700 tabular-nums whitespace-nowrap"
              >
                批判
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr
                key={`${row.company_name}\0${row.business_unit_name}\0${i}`}
                className={i % 2 === 0 ? "bg-muted/25" : ""}
              >
                <td className="py-2 px-3 align-top max-w-[12rem] truncate">
                  {cellOrg(row.company_name)}
                </td>
                <td className="py-2 px-3 align-top max-w-[12rem] truncate">
                  {cellOrg(row.business_unit_name)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  <CountCell
                    row={row}
                    count={row.respondent_count}
                    segment="all"
                    className="tabular-nums"
                    ariaLabel={`${cellOrg(row.company_name)} ${cellOrg(row.business_unit_name)} の回答者一覧を表示`}
                  />
                </td>
                <td className="py-2 px-3 text-right font-semibold tabular-nums">
                  {row.respondent_count === 0
                    ? "—"
                    : `${row.nps > 0 ? "+" : ""}${row.nps}`}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-green-700">
                  <CountCell
                    row={row}
                    count={row.promoters}
                    segment="promoter"
                    className="tabular-nums text-green-700"
                    ariaLabel={`${cellOrg(row.company_name)} ${cellOrg(row.business_unit_name)} の推奨者（9〜10点）の内訳を表示`}
                  />
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-yellow-700">
                  <CountCell
                    row={row}
                    count={row.passives}
                    segment="passive"
                    className="tabular-nums text-yellow-700"
                    ariaLabel={`${cellOrg(row.company_name)} ${cellOrg(row.business_unit_name)} の中立者（7〜8点）の内訳を表示`}
                  />
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-red-700">
                  <CountCell
                    row={row}
                    count={row.detractors}
                    segment="detractor"
                    className="tabular-nums text-red-700"
                    ariaLabel={`${cellOrg(row.company_name)} ${cellOrg(row.business_unit_name)} の批判者（0〜6点）の内訳を表示`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={openDetail !== null}
        onOpenChange={(o) => {
          if (!o) setOpenDetail(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 overflow-hidden p-0">
          {openDetail && drilldown ? (
            <>
              <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                <DialogTitle className="text-base leading-snug">
                  {segmentLabel(openDetail.segment)}
                </DialogTitle>
                <DialogDescription className="text-left space-y-1">
                  <span className="block">
                    {cellOrg(openDetail.row.company_name)} ·{" "}
                    {cellOrg(openDetail.row.business_unit_name)}
                  </span>
                  <span className="text-xs">{variantLabel}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="border-t border-border px-6 py-4 overflow-y-auto flex-1 min-h-0">
                {drilldownList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    該当する回答がありません。
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th
                            scope="col"
                            className="py-2.5 px-3 text-left font-medium whitespace-nowrap"
                          >
                            氏名
                          </th>
                          <th
                            scope="col"
                            className="py-2.5 px-3 text-right font-medium tabular-nums whitespace-nowrap w-px"
                          >
                            得点
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {drilldownList.map((r, j) => (
                          <tr
                            key={r.user_id}
                            className={j % 2 === 0 ? "bg-muted/25" : ""}
                          >
                            <td className="py-2 px-3 font-medium whitespace-nowrap">
                              {r.user_name}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-semibold">
                              {r.score_value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

type QuestionMeta = { id: string; question_text: string };

export function EnpsNpsByOrgTables(props: {
  scoreQuestions: QuestionMeta[];
  rowsByQuestion: Record<string, EnpsOrgNpsRow[]>;
  variant: "on_time" | "late_only";
  /** 指定時はそのスコア質問のテーブルのみ表示 */
  activeQuestionId?: string;
  /** 行・セルクリック時のユーザー別内訳（集計と同じ重複排除ルール） */
  drilldownSourceRows?: EnpsOrgDrilldownSourceRow[];
}) {
  const {
    scoreQuestions,
    rowsByQuestion,
    variant,
    activeQuestionId,
    drilldownSourceRows,
  } = props;

  const questionsToRender = activeQuestionId
    ? scoreQuestions.filter((q) => q.id === activeQuestionId)
    : scoreQuestions;

  const hasAny = questionsToRender.some(
    (q) => (rowsByQuestion[q.id]?.length ?? 0) > 0,
  );
  if (!hasAny) return null;

  const title =
    variant === "on_time"
      ? "事業部別 NPS（期限内）"
      : "事業部別 NPS（期限後・承認済みのみ）";

  const footnote =
    variant === "on_time"
      ? "同一ユーザー・同一質問は最新の回答1件のみを集計しています（事業部未設定は「—」行）。数字をクリックすると氏名と得点の内訳を表示します。"
      : "同一ユーザー・同一質問は最新の回答1件のみを集計しています。数字をクリックすると氏名と得点の内訳を表示します。";

  return (
    <div className="space-y-6">
      {questionsToRender.map((q) => {
        const rows = rowsByQuestion[q.id] ?? [];
        if (rows.length === 0) return null;
        const drilldown =
          drilldownSourceRows && drilldownSourceRows.length > 0
            ? {
                questionId: q.id,
                variant,
                rows: drilldownSourceRows,
              }
            : undefined;
        return (
          <Card key={`org-${variant}-${q.id}`}>
            <CardHeader>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-pretty">
                {q.question_text}
              </CardDescription>
              <CardDescription className="text-xs text-muted-foreground">
                {footnote}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrgNpsTable rows={rows} drilldown={drilldown} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
