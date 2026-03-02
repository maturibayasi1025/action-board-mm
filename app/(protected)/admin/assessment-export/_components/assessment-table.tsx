"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AssessmentRow, getAssessmentData } from "../actions";

function generateYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = 2020; year <= currentYear; year++) {
    years.push(year);
  }
  return years.reverse();
}

function generateMonthOptions(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

function getDateFromYearMonth(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toISOString();
}

function getEndDateFromYearMonth(year: number, month: number): string {
  const date = new Date(year, month, 0, 23, 59, 59, 999);
  return date.toISOString();
}

type SortKey =
  | "userName"
  | "prefecture"
  | "goodjobPostedCount"
  | "goodjobReceivedCount"
  | "passionateExecutionCount"
  | "supremeRelationshipsCount"
  | "happinessCirculationCount"
  | "likesGivenCount"
  | "likesReceivedCount"
  | "postingDaysCount"
  | "missionAchievementCount"
  | "totalXp"
  | "currentLevel"
  | "registeredAt";
type SortOrder = "asc" | "desc";

/** CSV用に値をエスケープ（カンマ・改行・ダブルクォートを含む場合） */
function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function AssessmentTable() {
  const [data, setData] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);

  const [sortKey, setSortKey] = useState<SortKey>("userName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const years = generateYearOptions();
  const months = generateMonthOptions();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const startDate = getDateFromYearMonth(startYear, startMonth);
      const endDate = getEndDateFromYearMonth(endYear, endMonth);

      const result = await getAssessmentData(startDate, endDate);
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error);
        setData([]);
      }
      setLoading(false);
    }

    fetchData();
  }, [startYear, startMonth, endYear, endMonth]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder(
        ["userName", "prefecture", "registeredAt"].includes(key)
          ? "asc"
          : "desc",
      );
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue, "ja")
          : bValue.localeCompare(aValue, "ja");
      }

      return sortOrder === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [data, sortKey, sortOrder]);

  const handleDownloadCsv = () => {
    const headers = [
      "ユーザー名",
      "都道府県",
      "グッジョブ投稿数",
      "グッジョブもらった数（称賛された数）",
      "夢中になってやり切る（称賛数）",
      "至高な人間関係（称賛数）",
      "幸せの循環（称賛数）",
      "いいね押した数",
      "いいねもらった数",
      "投稿日数",
      "ミッション達成数",
      "総XP",
      "現在レベル",
      "登録日",
    ];

    const rows = sortedData.map((row) => [
      escapeCsvCell(row.userName),
      escapeCsvCell(row.prefecture),
      row.goodjobPostedCount,
      row.goodjobReceivedCount,
      row.passionateExecutionCount,
      row.supremeRelationshipsCount,
      row.happinessCirculationCount,
      row.likesGivenCount,
      row.likesReceivedCount,
      row.postingDaysCount,
      row.missionAchievementCount,
      row.totalXp,
      row.currentLevel,
      escapeCsvCell(
        row.registeredAt
          ? new Date(row.registeredAt).toISOString().slice(0, 10)
          : "",
      ),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvContent], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `査定データ_${startYear}${startMonth.toString().padStart(2, "0")}-${endYear}${endMonth.toString().padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>査定データ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={data.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            CSVダウンロード
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            読み込み中...
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            データがありません
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-semibold min-w-[120px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("userName")}
                    >
                      ユーザー名
                      {sortKey === "userName" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold min-w-[80px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("prefecture")}
                    >
                      都道府県
                      {sortKey === "prefecture" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[80px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("goodjobPostedCount")}
                    >
                      グッジョブ投稿
                      {sortKey === "goodjobPostedCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[100px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("goodjobReceivedCount")}
                    >
                      称賛された数
                      {sortKey === "goodjobReceivedCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[70px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("passionateExecutionCount")}
                    >
                      夢中
                      {sortKey === "passionateExecutionCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[70px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("supremeRelationshipsCount")}
                    >
                      人間関係
                      {sortKey === "supremeRelationshipsCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[70px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("happinessCirculationCount")}
                    >
                      幸せ循環
                      {sortKey === "happinessCirculationCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[70px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("likesGivenCount")}
                    >
                      いいね押した
                      {sortKey === "likesGivenCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[70px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("likesReceivedCount")}
                    >
                      いいねもらった
                      {sortKey === "likesReceivedCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[60px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("postingDaysCount")}
                    >
                      投稿日数
                      {sortKey === "postingDaysCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[70px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("missionAchievementCount")}
                    >
                      ミッション達成
                      {sortKey === "missionAchievementCount" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[60px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("totalXp")}
                    >
                      総XP
                      {sortKey === "totalXp" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold min-w-[50px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full justify-center font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("currentLevel")}
                    >
                      レベル
                      {sortKey === "currentLevel" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold min-w-[90px]">
                    <button
                      type="button"
                      className="flex items-center gap-1 font-semibold hover:text-primary transition-colors cursor-pointer"
                      onClick={() => handleSort("registeredAt")}
                    >
                      登録日
                      {sortKey === "registeredAt" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row) => (
                  <tr key={row.userId} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{row.userName}</td>
                    <td className="px-3 py-2">{row.prefecture}</td>
                    <td className="px-3 py-2 text-center">
                      {row.goodjobPostedCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.goodjobReceivedCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.passionateExecutionCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.supremeRelationshipsCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.happinessCirculationCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.likesGivenCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.likesReceivedCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.postingDaysCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.missionAchievementCount}
                    </td>
                    <td className="px-3 py-2 text-center">{row.totalXp}</td>
                    <td className="px-3 py-2 text-center">
                      {row.currentLevel}
                    </td>
                    <td className="px-3 py-2">
                      {row.registeredAt
                        ? new Date(row.registeredAt).toISOString().slice(0, 10)
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
