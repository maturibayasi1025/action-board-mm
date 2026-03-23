"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type AdminSurveyResponseRow,
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
  return Boolean(row.text_value?.trim());
}

function formatAnswerCell(
  question: AdminSurveyQuestion,
  row: AdminSurveyResponseRow,
): string | null {
  if (question.question_type === "score_0_10" && row.score_value !== null) {
    return `${row.score_value}点`;
  }
  const t = row.text_value?.trim();
  return t || null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP");
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
}

export function SurveyResponsesPanel({
  questions,
  responses,
}: SurveyResponsesPanelProps) {
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

  const firstOpenQuestionId = sortedQuestions.find((q) =>
    scopedDeduped.some((r) => r.question_id === q.id && rowHasAnswer(q, r)),
  )?.id;

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
        <Accordion
          type="single"
          collapsible
          defaultValue={firstOpenQuestionId}
          className="w-full"
        >
          {sortedQuestions.map((question) => {
            const rows = scopedDeduped
              .filter(
                (r) =>
                  r.question_id === question.id && rowHasAnswer(question, r),
              )
              .sort((a, b) => a.user_name.localeCompare(b.user_name, "ja"));
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
                        {rows.map((row, i) => {
                          const answer = formatAnswerCell(question, row);
                          return (
                            <tr
                              key={row.id}
                              className={i % 2 === 0 ? "bg-muted/25" : ""}
                            >
                              <td className="py-2.5 px-3 align-top font-medium whitespace-nowrap">
                                {row.user_name}
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
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </TabsContent>
      <TabsContent value="by-respondent" className="mt-0">
        <Accordion type="multiple" className="w-full">
          {groupedByUser.map((user) => {
            const answeredInScope = sortedQuestions.filter((q) => {
              const r = user.byQuestionId[q.id];
              return r && rowHasAnswer(q, r);
            });
            if (answeredInScope.length === 0) return null;

            return (
              <AccordionItem key={user.userId} value={user.userId}>
                <AccordionTrigger className="text-left text-sm hover:no-underline py-3">
                  <span>
                    <span className="font-medium">{user.userName}</span>
                    <span className="ml-2 text-muted-foreground font-normal">
                      （{answeredInScope.length}問）
                    </span>
                  </span>
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
