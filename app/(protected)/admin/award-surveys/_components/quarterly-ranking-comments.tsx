"use client";

import type { AwardQuarterRankingComment } from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type QuarterlyRankingCommentsProps = {
  comments: AwardQuarterRankingComment[];
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

export function QuarterlyRankingComments({
  comments,
  nomineeName,
}: QuarterlyRankingCommentsProps) {
  if (comments.length === 0) {
    return null;
  }

  const withTextCount = comments.filter((row) => row.comment.length > 0).length;

  return (
    <Accordion type="single" collapsible className="mt-1 pl-11">
      <AccordionItem value="comments" className="border-none">
        <AccordionTrigger className="py-1.5 text-xs text-muted-foreground hover:no-underline">
          寄せられたコメント {withTextCount}/{comments.length}件
        </AccordionTrigger>
        <AccordionContent>
          <ul className="space-y-2" aria-label={`${nomineeName}へのコメント`}>
            {comments.map((row, index) => {
              const month = monthLabel(row.yearMonth);
              return (
                <li
                  key={`${row.recommenderName}-${row.yearMonth ?? ""}-${index}`}
                  className="rounded-md bg-muted/50 px-2.5 py-2"
                >
                  <p className="text-xs font-medium text-foreground">
                    {row.recommenderName}
                    {month ? (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {month}
                        {row.isLate ? "・期限後" : ""}
                      </span>
                    ) : row.isLate ? (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        期限後
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
  );
}
