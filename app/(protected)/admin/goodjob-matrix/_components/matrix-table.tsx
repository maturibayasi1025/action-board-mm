"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type MatrixRow, getMatrixData } from "../actions";
import { DetailModal } from "./detail-modal";

// 年と月のオプションを生成
function generateYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  // 2020年から現在年まで
  for (let year = 2020; year <= currentYear; year++) {
    years.push(year);
  }
  return years.reverse();
}

function generateMonthOptions(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1);
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

export function MatrixTable() {
  const [matrixData, setMatrixData] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 現在の年月をデフォルトに設定
  const now = new Date();
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);

  // モーダル状態
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedMvvType, setSelectedMvvType] = useState<
    | "passionate_execution"
    | "supreme_relationships"
    | "happiness_circulation"
    | null
  >(null);

  const years = generateYearOptions();
  const months = generateMonthOptions();

  // データ取得
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const startDate = getDateFromYearMonth(startYear, startMonth);
      const endDate = getEndDateFromYearMonth(endYear, endMonth);

      const result = await getMatrixData(startDate, endDate);
      if (result.success) {
        setMatrixData(result.data);
      } else {
        toast.error(result.error);
        setMatrixData([]);
      }
      setLoading(false);
    }

    fetchData();
  }, [startYear, startMonth, endYear, endMonth]);

  // 上位10%の閾値を計算
  const calculateThreshold = (): number => {
    const allValues = matrixData
      .flatMap((row) => [
        row.passionateExecution,
        row.supremeRelationships,
        row.happinessCirculation,
      ])
      .filter((v) => v > 0);

    if (allValues.length === 0) return Number.POSITIVE_INFINITY;

    const sorted = [...allValues].sort((a, b) => b - a);
    const top10Index = Math.floor(sorted.length * 0.1);
    return sorted[top10Index] || Number.POSITIVE_INFINITY;
  };

  const threshold = calculateThreshold();

  // セルのスタイルを取得
  const getCellClass = (value: number): string => {
    if (value >= threshold && value > 0) {
      return "bg-red-100 text-red-800 font-bold";
    }
    return "";
  };

  // セルクリックハンドラー
  const handleCellClick = (
    userId: string,
    mvvType:
      | "passionate_execution"
      | "supreme_relationships"
      | "happiness_circulation",
  ) => {
    setSelectedUserId(userId);
    setSelectedMvvType(mvvType);
    setModalOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>マトリクス表</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 期間選択UI */}
        <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">開始:</span>
            <Select
              value={startYear.toString()}
              onValueChange={(value) =>
                setStartYear(Number.parseInt(value, 10))
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={startMonth.toString()}
              onValueChange={(value) =>
                setStartMonth(Number.parseInt(value, 10))
              }
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month.toString()}>
                    {month}月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">終了:</span>
            <Select
              value={endYear.toString()}
              onValueChange={(value) => setEndYear(Number.parseInt(value, 10))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={endMonth.toString()}
              onValueChange={(value) => setEndMonth(Number.parseInt(value, 10))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month.toString()}>
                    {month}月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* テーブル */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            読み込み中...
          </div>
        ) : matrixData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            データがありません
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold sticky left-0 z-20 bg-muted/50 min-w-[150px]">
                    メンバー
                  </th>
                  <th className="px-4 py-3 text-center font-semibold min-w-[150px]">
                    夢中になってやり切る
                  </th>
                  <th className="px-4 py-3 text-center font-semibold min-w-[150px]">
                    至高な人間関係
                  </th>
                  <th className="px-4 py-3 text-center font-semibold min-w-[150px]">
                    幸せの循環
                  </th>
                  <th className="px-4 py-3 text-center font-semibold min-w-[100px]">
                    合計
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row) => (
                  <tr key={row.userId} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium sticky left-0 z-10 bg-background border-r">
                      {row.userName}
                    </td>
                    <td
                      className={`px-0 py-0 ${getCellClass(row.passionateExecution)}`}
                    >
                      <button
                        type="button"
                        className="w-full px-4 py-3 text-center cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={() =>
                          handleCellClick(row.userId, "passionate_execution")
                        }
                      >
                        {row.passionateExecution}
                      </button>
                    </td>
                    <td
                      className={`px-0 py-0 ${getCellClass(row.supremeRelationships)}`}
                    >
                      <button
                        type="button"
                        className="w-full px-4 py-3 text-center cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={() =>
                          handleCellClick(row.userId, "supreme_relationships")
                        }
                      >
                        {row.supremeRelationships}
                      </button>
                    </td>
                    <td
                      className={`px-0 py-0 ${getCellClass(row.happinessCirculation)}`}
                    >
                      <button
                        type="button"
                        className="w-full px-4 py-3 text-center cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={() =>
                          handleCellClick(row.userId, "happiness_circulation")
                        }
                      >
                        {row.happinessCirculation}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold bg-muted/20">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 凡例 */}
        <div className="text-sm text-muted-foreground">
          <p>
            ※
            セルをクリックすると詳細を表示します。上位10%のセルは赤色で表示されます。
          </p>
        </div>
      </CardContent>

      {/* 詳細モーダル */}
      {selectedUserId && selectedMvvType && (
        <DetailModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedUserId(null);
            setSelectedMvvType(null);
          }}
          userId={selectedUserId}
          mvvType={selectedMvvType}
          startYear={startYear}
          startMonth={startMonth}
          endYear={endYear}
          endMonth={endMonth}
        />
      )}
    </Card>
  );
}
