"use client";

import type {
  AwardQuarterRankingComment,
  AwardQuarterSelfEvalComment,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type QuarterlyRankingCommentsProps = {
  comments: AwardQuarterRankingComment[];
  selfEvalComments: AwardQuarterSelfEvalComment[];
  selfEvalAvailable: boolean;
  nomineeName: string;
};

function monthLabel(yearMonth: string | null): string | null {
  if (!yearMonth) return null;
  const month = Number(yearMonth.slice(5));
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return yearMonth;
  }
  return `${month}月`;
}

function monthMeta(yearMonth: string | null, isLate: boolean): string | null {
  const month = monthLabel(yearMonth);
  if (month && isLate) return `${month}・期限後`;
  if (month) return month;
  if (isLate) return "期限後";
  return null;
}

export function QuarterlyRankingComments({
  comments,
  selfEvalComments,
  selfEvalAvailable,
  nomineeName,
}: QuarterlyRankingCommentsProps) {
  const withTextCount = comments.filter((row) => row.comment.length > 0).length;
  const showNomination = comments.length > 0;
  const showSelfEval = selfEvalAvailable && selfEvalComments.length > 0;
  const showSelfEvalEmpty = selfEvalAvailable && selfEvalComments.length === 0;
  if (!showNomination && !showSelfEval && !showSelfEvalEmpty) {
    return null;
  }

  return (
    <div className="mt-1 space-y-1 pl-11">
      {comments.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="comments" className="border-none">
            <AccordionTrigger className="py-1.5 text-xs text-muted-foreground hover:no-underline">
              寄せられたコメント {withTextCount}/{comments.length}件
            </AccordionTrigger>
            <AccordionContent>
              <ul
                className="space-y-2"
                aria-label={`${nomineeName}へのコメント`}
              >
                {comments.map((row, index) => {
                  const meta = monthMeta(row.yearMonth, row.isLate);
                  return (
                    <li
                      key={`${row.recommenderName}-${row.yearMonth ?? ""}-${index}`}
                      className="rounded-md bg-muted/50 px-2.5 py-2"
                    >
                      <p className="text-xs font-medium text-foreground">
                        {row.recommenderName}
                        {meta ? (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {meta}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                        {row.comment || (
                          <span className="text-muted-foreground">
                            （コメントなし）
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {selfEvalAvailable && selfEvalComments.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="self-eval" className="border-none">
            <AccordionTrigger className="py-1.5 text-xs text-muted-foreground hover:no-underline">
              自己評価コメント {selfEvalComments.length}件
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2" aria-label={`${nomineeName}の自己評価`}>
                {selfEvalComments.map((row, index) => {
                  const meta = monthMeta(row.yearMonth, row.isLate);
                  return (
                    <li
                      key={`${row.yearMonth ?? ""}-${index}`}
                      className="rounded-md bg-muted/50 px-2.5 py-2"
                    >
                      {meta ? (
                        <p className="text-xs font-medium text-muted-foreground">
                          {meta}
                        </p>
                      ) : null}
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                        {row.comment}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {selfEvalAvailable && selfEvalComments.length === 0 && (
        <p className="py-1 text-xs text-muted-foreground">
          自己評価コメント なし
        </p>
      )}
    </div>
  );
}
