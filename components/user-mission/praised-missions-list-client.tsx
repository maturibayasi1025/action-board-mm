"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/utils";
import { Calendar, Heart, Search, User, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { UserMission } from "@/lib/types/user-missions";

export function PraisedMissionsListClient({
  missions,
}: {
  missions: UserMission[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedMvvItems, setSelectedMvvItems] = useState<Set<string>>(
    new Set(),
  );

  // 年の選択肢を生成（現在から過去5年）
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // 日付フォーマット関数（YYYY年MM月）
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}年${month}月`;
  };

  // フィルタリング
  const filteredMissions = useMemo(() => {
    let filtered = missions;

    // ユーザー名検索（作成者名も検索対象に含める）
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((mission) => {
        const createdByNameMatch =
          mission.createdByName?.toLowerCase().includes(query) ?? false;
        const praisedUsersMatch = mission.praisedUsers.some((userName) =>
          userName.toLowerCase().includes(query),
        );
        const externalUsersMatch =
          mission.praisedExternalUsers?.some((userName) =>
            userName.toLowerCase().includes(query),
          ) || false;
        return createdByNameMatch || praisedUsersMatch || externalUsersMatch;
      });
    }

    // 登録時期検索
    if (selectedYear !== "all" && selectedMonth !== "all") {
      const year = Number(selectedYear);
      const month = Number(selectedMonth);
      filtered = filtered.filter((mission) => {
        const missionDate = new Date(mission.createdAt);
        return (
          missionDate.getFullYear() === year &&
          missionDate.getMonth() + 1 === month
        );
      });
    } else if (selectedYear !== "all") {
      const year = Number(selectedYear);
      filtered = filtered.filter((mission) => {
        const missionDate = new Date(mission.createdAt);
        return missionDate.getFullYear() === year;
      });
    } else if (selectedMonth !== "all") {
      const month = Number(selectedMonth);
      filtered = filtered.filter((mission) => {
        const missionDate = new Date(mission.createdAt);
        return missionDate.getMonth() + 1 === month;
      });
    }

    // MVV項目フィルタリング
    if (selectedMvvItems.size > 0) {
      filtered = filtered.filter((mission) => {
        return (
          (selectedMvvItems.has("passionateExecution") &&
            mission.mvvItems.passionateExecution) ||
          (selectedMvvItems.has("supremeRelationships") &&
            mission.mvvItems.supremeRelationships) ||
          (selectedMvvItems.has("happinessCirculation") &&
            mission.mvvItems.happinessCirculation)
        );
      });
    }

    return filtered;
  }, [missions, searchQuery, selectedYear, selectedMonth, selectedMvvItems]);

  const renderMissionCard = (mission: UserMission) => {
    const supabase = createClient();
    return (
      <Card key={mission.id} className="flex min-w-0 flex-col">
        <CardHeader className="min-w-0 p-4 md:p-6">
          <div className="mb-2 flex min-w-0 w-full items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 min-w-0 flex-1 break-words">
              {mission.title}
            </CardTitle>
          </div>
          <CardDescription className="flex min-w-0 flex-col gap-2">
            {(mission.praisedUsers.length > 0 ||
              (mission.praisedExternalUsers &&
                mission.praisedExternalUsers.length > 0)) && (
              <div className="flex min-w-0 items-start gap-2">
                <User className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 break-words">
                  賞賛対象:{" "}
                  {[
                    ...mission.praisedUsers,
                    ...(mission.praisedExternalUsers || []),
                  ].join(", ")}
                </span>
              </div>
            )}
            <div className="min-w-0 break-words text-sm text-muted-foreground">
              作成者: {mission.createdByName}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 flex-1 p-4 pt-0 md:p-6 md:pt-0">
          {/* 画像表示 */}
          {mission.imagePaths && mission.imagePaths.length > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              {mission.imagePaths.slice(0, 3).map((path) => {
                const { data } = supabase.storage
                  .from("user_mission_images")
                  .getPublicUrl(path);
                return (
                  <img
                    key={path}
                    src={data.publicUrl}
                    alt={`${mission.title}`}
                    className="w-full h-24 object-cover rounded border"
                  />
                );
              })}
            </div>
          )}
          <p className="line-clamp-3 min-w-0 break-words text-sm text-muted-foreground">
            {mission.content || "（内容未入力）"}
          </p>
          <div className="mt-4 flex min-w-0 flex-wrap gap-2">
            {mission.mvvItems.passionateExecution && (
              <Badge variant="outline">夢中になってやりきる</Badge>
            )}
            {mission.mvvItems.supremeRelationships && (
              <Badge variant="outline">至高な人間関係</Badge>
            )}
            {mission.mvvItems.happinessCirculation && (
              <Badge variant="outline">幸せの循環</Badge>
            )}
            {!mission.mvvItems.passionateExecution &&
              !mission.mvvItems.supremeRelationships &&
              !mission.mvvItems.happinessCirculation && (
                <span className="text-xs text-muted-foreground">
                  MVV項目未選択
                </span>
              )}
          </div>
        </CardContent>
        <CardFooter className="flex min-w-0 flex-col gap-2 p-4 pt-0 md:flex-row md:items-center md:justify-between md:p-6 md:pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {mission.likesCount > 10 && (
              <svg width="0" height="0" className="absolute" aria-hidden="true">
                <defs>
                  <linearGradient
                    id={`rainbow-gradient-praised-${mission.id}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="14.28%" stopColor="#FFA500" />
                    <stop offset="28.57%" stopColor="#FFD4A3" />
                    <stop offset="42.85%" stopColor="#FFB347" />
                    <stop offset="57.14%" stopColor="#FFE4B5" />
                    <stop offset="71.42%" stopColor="#F0E68C" />
                    <stop offset="85.71%" stopColor="#FF8C00" />
                    <stop offset="100%" stopColor="#FFD700" />
                  </linearGradient>
                </defs>
              </svg>
            )}
            <Heart
              className={cn(
                "h-4 w-4 transition-all",
                mission.likesCount > 10 && "animate-rainbow-glow",
              )}
              style={
                mission.likesCount > 10
                  ? {
                      fill: `url(#rainbow-gradient-praised-${mission.id})`,
                      filter:
                        "drop-shadow(0 0 4px rgba(255, 215, 0, 0.4)) drop-shadow(0 0 8px rgba(255, 165, 0, 0.3)) drop-shadow(0 0 12px rgba(255, 212, 163, 0.2))",
                    }
                  : undefined
              }
            />
            <span className={cn(mission.likesCount > 10 && "font-semibold")}>
              {mission.likesCount}
            </span>
          </div>
          <Link
            href={`/user-missions/${mission.id}`}
            className="w-full md:w-auto md:ml-auto"
          >
            <Button variant="ghost" size="sm" className="w-full md:w-auto">
              詳細を見る
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  };

  if (missions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          自分宛のグッジョブはまだありません
        </p>
        <p className="text-sm text-muted-foreground">
          他のユーザーからグッジョブを送られると、ここに表示されます
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 検索フィールド */}
      <div className="space-y-4">
        {/* ユーザー名検索 */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="作成者名または賞賛対象者名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* 登録時期検索 */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="年を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての年</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="月を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての月</SelectItem>
              {months.map((month) => (
                <SelectItem key={month} value={month.toString()}>
                  {month}月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(selectedYear !== "all" || selectedMonth !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedYear("all");
                setSelectedMonth("all");
              }}
            >
              クリア
            </Button>
          )}
        </div>

        {/* MVV項目フィルタリング */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            MVV項目で絞り込み
          </span>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                selectedMvvItems.has("passionateExecution")
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer"
              onClick={() => {
                const newSet = new Set(selectedMvvItems);
                if (newSet.has("passionateExecution")) {
                  newSet.delete("passionateExecution");
                } else {
                  newSet.add("passionateExecution");
                }
                setSelectedMvvItems(newSet);
              }}
            >
              夢中になってやりきる
            </Badge>
            <Badge
              variant={
                selectedMvvItems.has("supremeRelationships")
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer"
              onClick={() => {
                const newSet = new Set(selectedMvvItems);
                if (newSet.has("supremeRelationships")) {
                  newSet.delete("supremeRelationships");
                } else {
                  newSet.add("supremeRelationships");
                }
                setSelectedMvvItems(newSet);
              }}
            >
              至高な人間関係
            </Badge>
            <Badge
              variant={
                selectedMvvItems.has("happinessCirculation")
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer"
              onClick={() => {
                const newSet = new Set(selectedMvvItems);
                if (newSet.has("happinessCirculation")) {
                  newSet.delete("happinessCirculation");
                } else {
                  newSet.add("happinessCirculation");
                }
                setSelectedMvvItems(newSet);
              }}
            >
              幸せの循環
            </Badge>
            {selectedMvvItems.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMvvItems(new Set())}
                className="h-6 text-xs"
              >
                クリア
              </Button>
            )}
          </div>
        </div>

        {/* 検索結果件数表示 */}
        {(searchQuery ||
          selectedYear !== "all" ||
          selectedMonth !== "all" ||
          selectedMvvItems.size > 0) && (
          <p className="text-sm text-muted-foreground">
            {filteredMissions.length}件のグッジョブが見つかりました（全
            {missions.length}件）
          </p>
        )}
      </div>

      {/* 検索結果がない場合 */}
      {filteredMissions.length === 0 &&
      (searchQuery ||
        selectedYear !== "all" ||
        selectedMonth !== "all" ||
        selectedMvvItems.size > 0) ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            検索条件に一致するグッジョブが見つかりませんでした
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setSelectedYear("all");
              setSelectedMonth("all");
              setSelectedMvvItems(new Set());
            }}
          >
            検索をクリア
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 px-4 md:gap-6 md:px-0 md:grid-cols-2 lg:grid-cols-3">
          {filteredMissions.map(renderMissionCard)}
        </div>
      )}
    </div>
  );
}
