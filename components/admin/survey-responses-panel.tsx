"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type AdminSurveyResponseRow,
  type ResponseSortOrder,
  compareAdminSurveyRows,
  compareGroupedRespondents,
  dedupeSurveyResponsesLatestPerQuestion,
  groupDedupedResponsesByUser,
} from "@/lib/admin/group-survey-responses";
import { cn } from "@/lib/utils/utils";
import { useMemo, useState } from "react";

export interface AdminSurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  display_order: number;
}

function rowHasAnswer(
  question: AdminSurveyQuestion,
  row: AdminSurveyResponseRow,
): boolean {
  if (question.question_type === "score_0_10") {
    return row.score_value !== null;
  }
  if (question.question_type === "user_select") {
    return Boolean(row.nominee_user_id) || Boolean(row.text_value?.trim());
  }
  return Boolean(row.text_value?.trim());
}

function formatAnswerCell(
  question: AdminSurveyQuestion,
  row: AdminSurveyResponseRow,
): string | null {
  if (question.question_type === "score_0_10" && row.score_value !== null) {
    return `${row.score_value}点`;
  }
  if (question.question_type === "user_select") {
    if (row.nominee_user_name) {
      return row.nominee_user_name;
    }
    if (row.nominee_user_id) {
      return row.nominee_user_id;
    }
  }
  const t = row.text_value?.trim();
  return t || null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP");
}

function orgDisplayLabel(value: string): string {
  return value === "" ? "—" : value;
}

type NpsSegmentFilter = "all" | "promoter" | "passive" | "detractor";

function npsSegmentForScore(score: number): Exclude<NpsSegmentFilter, "all"> {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

function scoreMatchesNpsSegment(
  score: number,
  segment: NpsSegmentFilter,
): boolean {
  if (segment === "all") return true;
  return npsSegmentForScore(score) === segment;
}

function SortOrderSelectItems({ mode }: { mode: "score" | "text" }) {
  return (
    <>
      <SelectItem value="name">氏名（あいうえお順）</SelectItem>
      <SelectItem value="company">会社名（あいうえお順）</SelectItem>
      <SelectItem value="business_unit">事業部名（あいうえお順）</SelectItem>
      {mode === "score" ? (
        <>
          <SelectItem value="score_asc">スコア昇順（低→高）</SelectItem>
          <SelectItem value="score_desc">スコア降順（高→低）</SelectItem>
        </>
      ) : null}
    </>
  );
}

function QuestionResponsesBlock({
  question,
  rows,
}: {
  question: AdminSurveyQuestion;
  rows: AdminSurveyResponseRow[];
}) {
  const [segment, setSegment] = useState<NpsSegmentFilter>("all");
  const [sortOrder, setSortOrder] = useState<ResponseSortOrder>("name");

  const processedRows = useMemo(() => {
    if (question.question_type !== "score_0_10") {
      return [...rows].sort((a, b) => compareAdminSurveyRows(a, b, sortOrder));
    }

    const list = rows.filter((r) => {
      const s = r.score_value;
      if (s === null) return false;
      return scoreMatchesNpsSegment(s, segment);
    });

    return [...list].sort((a, b) => compareAdminSurveyRows(a, b, sortOrder));
  }, [rows, question.question_type, segment, sortOrder]);

  const showScoreFilters = question.question_type === "score_0_10";

  return (
    <>
      {showScoreFilters ? (
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5 min-w-[12rem] flex-1 sm:max-w-xs">
            <label
              htmlFor={`nps-segment-${question.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              NPS区分
            </label>
            <Select
              value={segment}
              onValueChange={(v) => setSegment(v as NpsSegmentFilter)}
            >
              <SelectTrigger
                id={`nps-segment-${question.id}`}
                className="h-9 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="promoter">推奨者（9〜10点）</SelectItem>
                <SelectItem value="passive">中立者（7〜8点）</SelectItem>
                <SelectItem value="detractor">批判者（0〜6点）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[12rem] flex-1 sm:max-w-xs">
            <label
              htmlFor={`score-sort-${question.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              並び順
            </label>
            <Select
              value={sortOrder}
              onValueChange={(v) => setSortOrder(v as ResponseSortOrder)}
            >
              <SelectTrigger
                id={`score-sort-${question.id}`}
                className="h-9 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SortOrderSelectItems mode="score" />
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground pb-0.5 sm:ml-auto">
            {processedRows.length}件を表示（全{rows.length}件）
          </p>
        </div>
      ) : (
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5 min-w-[12rem] flex-1 sm:max-w-xs">
            <label
              htmlFor={`text-sort-${question.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              並び順
            </label>
            <Select
              value={sortOrder}
              onValueChange={(v) => setSortOrder(v as ResponseSortOrder)}
            >
              <SelectTrigger
                id={`text-sort-${question.id}`}
                className="h-9 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SortOrderSelectItems mode="text" />
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground pb-0.5 sm:ml-auto">
            {processedRows.length}件
          </p>
        </div>
      )}

      {showScoreFilters && processedRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
          条件に該当する回答がありません。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th
                  scope="col"
                  className="sticky top-0 z-[1] bg-muted/95 py-2.5 px-3 text-left font-medium backdrop-blur-sm"
                >
                  氏名
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-[1] bg-muted/95 py-2.5 px-3 text-left font-medium backdrop-blur-sm whitespace-nowrap"
                >
                  会社
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-[1] bg-muted/95 py-2.5 px-3 text-left font-medium backdrop-blur-sm whitespace-nowrap"
                >
                  事業部
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-[1] bg-muted/95 py-2.5 px-3 text-left font-medium backdrop-blur-sm"
                >
                  回答
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-[1] bg-muted/95 py-2.5 px-3 text-right font-medium whitespace-nowrap backdrop-blur-sm w-px"
                >
                  回答日時
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {processedRows.map((row, i) => {
                const answer = formatAnswerCell(question, row);
                return (
                  <tr key={row.id} className={i % 2 === 0 ? "bg-muted/25" : ""}>
                    <td className="py-2.5 px-3 align-top font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        {row.user_name}
                        {row.is_late_submission ? (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            期限後
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 align-top text-muted-foreground whitespace-nowrap max-w-[10rem] truncate">
                      {orgDisplayLabel(row.company_name)}
                    </td>
                    <td className="py-2.5 px-3 align-top text-muted-foreground whitespace-nowrap max-w-[10rem] truncate">
                      {orgDisplayLabel(row.business_unit_name)}
                    </td>
                    <td className="py-2.5 px-3 align-top text-muted-foreground min-w-[12rem] max-w-[32rem]">
                      {answer &&
                        (question.question_type === "score_0_10" ? (
                          <span className="font-semibold text-foreground tabular-nums">
                            {answer}
                          </span>
                        ) : (
                          <ExpandableText text={answer} />
                        ))}
                    </td>
                    <td className="py-2.5 px-3 align-top text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ExpandableText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const lines = text.split("\n").length;
  const long = text.length > 160 || lines > 4;
  if (!long) {
    return <span className="whitespace-pre-wrap break-words">{text}</span>;
  }
  return (
    <div>
      <div
        className={cn(
          "whitespace-pre-wrap break-words",
          !open && "line-clamp-4",
        )}
      >
        {text}
      </div>
      <button
        type="button"
        className="mt-1 text-xs font-medium text-primary hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "折りたたむ" : "全文を表示"}
      </button>
    </div>
  );
}

export interface SurveyResponsesPanelProps {
  questions: AdminSurveyQuestion[];
  responses: AdminSurveyResponseRow[];
  /** single: 質問別タブで1問だけ表示（セレクトで切替） */
  questionScope?: "accordion" | "single";
}

export function SurveyResponsesPanel({
  questions,
  responses,
  questionScope = "accordion",
}: SurveyResponsesPanelProps) {
  const [respondentSort, setRespondentSort] =
    useState<ResponseSortOrder>("name");

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.display_order - b.display_order),
    [questions],
  );

  const deduped = useMemo(
    () => dedupeSurveyResponsesLatestPerQuestion(responses),
    [responses],
  );

  const questionIds = useMemo(
    () => new Set(sortedQuestions.map((q) => q.id)),
    [sortedQuestions],
  );

  const scopedDeduped = useMemo(
    () => deduped.filter((r) => questionIds.has(r.question_id)),
    [deduped, questionIds],
  );

  const groupedByUser = useMemo(
    () => groupDedupedResponsesByUser(scopedDeduped),
    [scopedDeduped],
  );

  const sortedGroupedByUser = useMemo(
    () =>
      [...groupedByUser].sort((a, b) =>
        compareGroupedRespondents(a, b, respondentSort),
      ),
    [groupedByUser, respondentSort],
  );

  const questionsWithAnswers = useMemo(
    () =>
      sortedQuestions.filter((q) =>
        scopedDeduped.some((r) => r.question_id === q.id && rowHasAnswer(q, r)),
      ),
    [sortedQuestions, scopedDeduped],
  );

  const firstOpenQuestionId = questionsWithAnswers[0]?.id;

  const [singleTabQuestionId, setSingleTabQuestionId] = useState<string | null>(
    null,
  );
  const effectiveSingleQuestionId =
    singleTabQuestionId &&
    questionsWithAnswers.some((q) => q.id === singleTabQuestionId)
      ? singleTabQuestionId
      : (firstOpenQuestionId ?? null);

  const singleModeQuestion = useMemo(() => {
    if (questionScope !== "single" || !effectiveSingleQuestionId) {
      return null;
    }
    return (
      questionsWithAnswers.find((q) => q.id === effectiveSingleQuestionId) ??
      null
    );
  }, [questionScope, effectiveSingleQuestionId, questionsWithAnswers]);

  const singleModeRows = useMemo(() => {
    if (!singleModeQuestion) {
      return [];
    }
    return scopedDeduped.filter(
      (r) =>
        r.question_id === singleModeQuestion.id &&
        rowHasAnswer(singleModeQuestion, r),
    );
  }, [scopedDeduped, singleModeQuestion]);

  if (scopedDeduped.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        まだ回答がありません。
      </p>
    );
  }

  return (
    <Tabs defaultValue="by-question" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="by-question">質問別</TabsTrigger>
        <TabsTrigger value="by-respondent">回答者別</TabsTrigger>
      </TabsList>
      <TabsContent value="by-question" className="mt-0">
        {questionScope === "single" ? (
          <div className="space-y-4">
            {questionsWithAnswers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
                表示できる回答がありません。
              </p>
            ) : (
              <>
                <div className="space-y-2 max-w-xl">
                  <Label htmlFor="survey-responses-question-select">
                    表示する質問
                  </Label>
                  <Select
                    value={effectiveSingleQuestionId ?? undefined}
                    onValueChange={(v) => setSingleTabQuestionId(v)}
                  >
                    <SelectTrigger
                      id="survey-responses-question-select"
                      className="w-full"
                    >
                      <SelectValue placeholder="質問を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {questionsWithAnswers.map((q) => {
                        const n = scopedDeduped.filter(
                          (r) => r.question_id === q.id && rowHasAnswer(q, r),
                        ).length;
                        return (
                          <SelectItem
                            key={q.id}
                            value={q.id}
                            title={q.question_text}
                          >
                            <span className="line-clamp-2 text-left">
                              {q.question_text}
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                （{n}件）
                              </span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {singleModeQuestion ? (
                  <QuestionResponsesBlock
                    question={singleModeQuestion}
                    rows={singleModeRows}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : (
          <Accordion
            type="single"
            collapsible
            defaultValue={firstOpenQuestionId}
            className="w-full"
          >
            {sortedQuestions.map((question) => {
              const rows = scopedDeduped.filter(
                (r) =>
                  r.question_id === question.id && rowHasAnswer(question, r),
              );
              if (rows.length === 0) return null;

              return (
                <AccordionItem key={question.id} value={question.id}>
                  <AccordionTrigger className="text-left text-sm hover:no-underline py-3">
                    <span className="pr-2">
                      <span className="font-medium">
                        {question.question_text}
                      </span>
                      <span className="ml-2 text-muted-foreground font-normal">
                        （{rows.length}件）
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <QuestionResponsesBlock question={question} rows={rows} />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </TabsContent>
      <TabsContent value="by-respondent" className="mt-0">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5 min-w-[12rem] flex-1 sm:max-w-xs">
            <label
              htmlFor="respondent-sort"
              className="text-xs font-medium text-muted-foreground"
            >
              回答者の並び順
            </label>
            <Select
              value={respondentSort}
              onValueChange={(v) => setRespondentSort(v as ResponseSortOrder)}
            >
              <SelectTrigger id="respondent-sort" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SortOrderSelectItems mode="text" />
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground pb-0.5 sm:ml-auto">
            回答者別では、スコア昇順・降順を選んでも氏名（あいうえお順）として並べます。
          </p>
        </div>
        <Accordion type="multiple" className="w-full">
          {sortedGroupedByUser.map((user) => {
            const answeredInScope = sortedQuestions.filter((q) => {
              const r = user.byQuestionId[q.id];
              return r && rowHasAnswer(q, r);
            });
            if (answeredInScope.length === 0) return null;

            return (
              <AccordionItem key={user.userId} value={user.userId}>
                <AccordionTrigger className="text-left text-sm hover:no-underline py-3 items-start gap-2 [&>svg]:shrink-0 [&>svg]:mt-1">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 pr-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                      <span className="font-medium">{user.userName}</span>
                      <span className="text-muted-foreground font-normal">
                        （{answeredInScope.length}問）
                      </span>
                    </div>
                    <div className="max-w-full truncate text-xs text-muted-foreground">
                      {user.company_name ? (
                        <span>{user.company_name} · </span>
                      ) : null}
                      <span>
                        事業部: {orgDisplayLabel(user.business_unit_name)}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-4 border-l-2 border-muted pl-4 ml-1">
                    {answeredInScope.map((q) => {
                      const row = user.byQuestionId[q.id];
                      if (!row) return null;
                      const answer = formatAnswerCell(q, row);
                      if (!answer) return null;
                      return (
                        <li key={q.id} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            {q.question_text}
                          </p>
                          {q.question_type === "score_0_10" ? (
                            <p className="text-sm font-semibold tabular-nums">
                              {answer}
                            </p>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              <ExpandableText text={answer} />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(row.created_at)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </TabsContent>
    </Tabs>
  );
}
