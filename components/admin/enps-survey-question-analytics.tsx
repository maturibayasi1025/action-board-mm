"use client";

import { EnpsNpsByOrgTables } from "@/components/admin/enps-nps-by-org-tables";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EnpsOrgDrilldownSourceRow,
  EnpsOrgNpsRow,
} from "@/lib/admin/enps-nps-by-business-unit";
import { useMemo, useState } from "react";

export type EnpsNpsBlock = {
  scores: number[];
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
};

type ScoreQuestionMeta = { id: string; question_text: string };

export interface EnpsSurveyQuestionAnalyticsProps {
  scoreQuestions: ScoreQuestionMeta[];
  npsData: Record<string, EnpsNpsBlock>;
  lateNpsData: Record<string, EnpsNpsBlock>;
  npsByBusinessUnitOnTime: Record<string, EnpsOrgNpsRow[]>;
  npsByBusinessUnitLate: Record<string, EnpsOrgNpsRow[]>;
  /** 事業部別テーブルのセルから開くユーザー別内訳用 */
  drilldownSourceRows: EnpsOrgDrilldownSourceRow[];
}

function NpsSummaryCard({
  question,
  nps,
}: {
  question: ScoreQuestionMeta;
  nps: EnpsNpsBlock | undefined;
}) {
  if (!nps || !nps.scores || nps.scores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{question.question_text}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            まだ回答がありません。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{question.question_text}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold">
            {nps.nps > 0 ? "+" : ""}
            {nps.nps}
          </div>
          <p className="text-sm text-muted-foreground mt-1">NPS</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold text-green-600">
              {nps.promoters}
            </div>
            <div className="text-xs text-muted-foreground">推奨者 (9-10点)</div>
            <div className="text-xs text-muted-foreground">
              {nps.scores.length > 0
                ? Math.round((nps.promoters / nps.scores.length) * 100)
                : 0}
              %
            </div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-yellow-600">
              {nps.passives}
            </div>
            <div className="text-xs text-muted-foreground">中立者 (7-8点)</div>
            <div className="text-xs text-muted-foreground">
              {nps.scores.length > 0
                ? Math.round((nps.passives / nps.scores.length) * 100)
                : 0}
              %
            </div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-red-600">
              {nps.detractors}
            </div>
            <div className="text-xs text-muted-foreground">批判者 (0-6点)</div>
            <div className="text-xs text-muted-foreground">
              {nps.scores.length > 0
                ? Math.round((nps.detractors / nps.scores.length) * 100)
                : 0}
              %
            </div>
          </div>
        </div>
        {nps.scores.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">スコア分布</div>
            <div className="flex items-end gap-1 h-32 border-b border-gray-200 pb-1">
              {([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(
                (scoreValue) => {
                  const count = nps.scores.filter(
                    (s) => s === scoreValue,
                  ).length;
                  const maxCount = Math.max(
                    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                      (j) => nps.scores.filter((s) => s === j).length,
                    ),
                    1,
                  );
                  const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div
                      key={`score-${scoreValue}`}
                      className="flex-1 flex flex-col items-center gap-1 justify-end"
                    >
                      {count > 0 && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {count}
                        </div>
                      )}
                      <div
                        className="w-full bg-primary rounded-t transition-all min-h-[2px]"
                        style={{
                          height: `${Math.max(height, count > 0 ? 2 : 0)}%`,
                        }}
                        title={`スコア ${scoreValue}: ${count}件`}
                      />
                      <span className="text-xs font-medium">{scoreValue}</span>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LateNpsCard({
  question,
  nps,
}: {
  question: ScoreQuestionMeta;
  nps: EnpsNpsBlock | undefined;
}) {
  if (!nps || !nps.scores || nps.scores.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{question.question_text}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold">
            {nps.nps > 0 ? "+" : ""}
            {nps.nps}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            NPS（期限後のみ）
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold text-green-600">
              {nps.promoters}
            </div>
            <div className="text-xs text-muted-foreground">推奨者</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-yellow-600">
              {nps.passives}
            </div>
            <div className="text-xs text-muted-foreground">中立者</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-red-600">
              {nps.detractors}
            </div>
            <div className="text-xs text-muted-foreground">批判者</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnpsSurveyQuestionAnalytics({
  scoreQuestions,
  npsData,
  lateNpsData,
  npsByBusinessUnitOnTime,
  npsByBusinessUnitLate,
  drilldownSourceRows,
}: EnpsSurveyQuestionAnalyticsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const defaultId = scoreQuestions[0]?.id ?? null;
  const effectiveId =
    selectedId && scoreQuestions.some((q) => q.id === selectedId)
      ? selectedId
      : defaultId;

  const activeQuestion = useMemo(
    () => scoreQuestions.find((q) => q.id === effectiveId),
    [scoreQuestions, effectiveId],
  );

  if (scoreQuestions.length === 0 || !activeQuestion) {
    return null;
  }

  const showQuestionPicker = scoreQuestions.length > 1;

  const lateNps = lateNpsData[activeQuestion.id];
  const hasLateForActive = Boolean(lateNps?.scores?.length);

  return (
    <div className="space-y-6">
      {showQuestionPicker && (
        <div className="space-y-2 max-w-xl">
          <Label htmlFor="enps-score-question-select">表示するスコア質問</Label>
          <Select
            value={effectiveId ?? undefined}
            onValueChange={(v) => setSelectedId(v)}
          >
            <SelectTrigger id="enps-score-question-select" className="w-full">
              <SelectValue placeholder="質問を選択" />
            </SelectTrigger>
            <SelectContent>
              {scoreQuestions.map((q) => (
                <SelectItem key={q.id} value={q.id} title={q.question_text}>
                  <span className="line-clamp-2 text-left">
                    {q.question_text}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="max-w-2xl">
        <NpsSummaryCard
          question={activeQuestion}
          nps={npsData[activeQuestion.id]}
        />
      </div>

      <EnpsNpsByOrgTables
        variant="on_time"
        scoreQuestions={scoreQuestions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
        }))}
        rowsByQuestion={npsByBusinessUnitOnTime}
        activeQuestionId={effectiveId ?? undefined}
        drilldownSourceRows={drilldownSourceRows}
      />

      {hasLateForActive && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-muted-foreground">
            期限後回答（承認済み）のNPS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LateNpsCard question={activeQuestion} nps={lateNps} />
          </div>
        </div>
      )}

      <EnpsNpsByOrgTables
        variant="late_only"
        scoreQuestions={scoreQuestions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
        }))}
        rowsByQuestion={npsByBusinessUnitLate}
        activeQuestionId={effectiveId ?? undefined}
        drilldownSourceRows={drilldownSourceRows}
      />
    </div>
  );
}
