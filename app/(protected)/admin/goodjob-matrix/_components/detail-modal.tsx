"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type GoodjobDetail, getGoodjobDetails } from "../actions";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  mvvType:
    | "passionate_execution"
    | "supreme_relationships"
    | "happiness_circulation";
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

// 年月からISO日付文字列を生成（その月の1日00:00:00）
function getDateFromYearMonth(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toISOString();
}

// 年月からISO日付文字列を生成（その月の最終日23:59:59）
function getEndDateFromYearMonth(year: number, month: number): string {
  const date = new Date(year, month, 0, 23, 59, 59, 999);
  return date.toISOString();
}

// MVVタイプの日本語名を取得
function getMvvTypeLabel(
  mvvType:
    | "passionate_execution"
    | "supreme_relationships"
    | "happiness_circulation",
): string {
  const labels = {
    passionate_execution: "夢中になってやり切る",
    supreme_relationships: "至高な人間関係",
    happiness_circulation: "幸せの循環",
  };
  return labels[mvvType];
}

export function DetailModal({
  isOpen,
  onClose,
  userId,
  mvvType,
  startYear,
  startMonth,
  endYear,
  endMonth,
}: DetailModalProps) {
  const [details, setDetails] = useState<GoodjobDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDetails([]);
      return;
    }

    async function fetchDetails() {
      setLoading(true);
      const startDate = getDateFromYearMonth(startYear, startMonth);
      const endDate = getEndDateFromYearMonth(endYear, endMonth);

      const result = await getGoodjobDetails(
        userId,
        mvvType,
        startDate,
        endDate,
      );
      if (result.success) {
        setDetails(result.data);
      } else {
        toast.error(result.error);
        setDetails([]);
      }
      setLoading(false);
    }

    fetchDetails();
  }, [isOpen, userId, mvvType, startYear, startMonth, endYear, endMonth]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getMvvTypeLabel(mvvType)} - グッジョブ詳細</DialogTitle>
          <DialogDescription>
            期間: {startYear}年{startMonth}月 〜 {endYear}年{endMonth}月
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            読み込み中...
          </div>
        ) : details.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            データがありません
          </div>
        ) : (
          <div className="space-y-4">
            {details.map((detail) => (
              <div
                key={detail.id}
                className="border rounded-lg p-4 space-y-2 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg">{detail.title}</h3>
                  <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">
                    {new Date(detail.approvedAt).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  送った人: {detail.createdByName}
                </p>
                {detail.content && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {detail.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
