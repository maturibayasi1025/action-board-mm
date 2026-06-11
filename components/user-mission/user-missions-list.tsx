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
import { LikeButton } from "@/components/user-mission/like-button";
import { createClient } from "@/lib/supabase/client";
import type { UserMission } from "@/lib/types/user-missions";
import { isLikeExpired } from "@/lib/utils/user-mission-likes";
import { Calendar, PenTool, Plus, Search, User, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function UserMissionsList({ missions }: { missions: UserMission[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedMvvItems, setSelectedMvvItems] = useState<Set<string>>(
    new Set(),
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 現在のユーザーIDを取得
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

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

  // 検索クエリと登録時期でフィルタリング
  const filteredMissions = useMemo(() => {
    let filtered = missions;

    // ユーザー名検索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((mission) => {
        // praisedUsersWithXUsernameがあればそれを使用、なければpraisedUsersを使用
        if (mission.praisedUsersWithXUsername) {
          return mission.praisedUsersWithXUsername.some((user) => {
            const nameMatch = user.name.toLowerCase().includes(query);
            const xUsernameMatch = user.x_username
              ? user.x_username.toLowerCase().includes(query)
              : false;
            return nameMatch || xUsernameMatch;
          });
        }
        // フォールバック: 文字列配列の場合
        const praisedUsersMatch = mission.praisedUsers.some((userName) =>
          userName.toLowerCase().includes(query),
        );
        const externalUsersMatch =
          mission.praisedExternalUsers?.some((userName) =>
            userName.toLowerCase().includes(query),
          ) || false;
        return praisedUsersMatch || externalUsersMatch;
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
        // 選択されたMVV項目のいずれかを含むグッジョブを表示（OR条件）
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

  if (missions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          まだユーザーグッジョブがありません
        </p>
        <Link href="/user-missions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            最初のグッジョブを作成
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* 検索フィールド */}
      <div className="mb-6 space-y-4">
        {/* ユーザー名検索 */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="賞賛されているユーザー名で検索..."
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
          {filteredMissions.map((mission) => (
            <Card key={mission.id} className="flex min-w-0 flex-col">
              <CardHeader className="min-w-0 p-4 md:p-6">
                <CardTitle className="line-clamp-2 min-w-0 break-words">
                  {mission.title}
                </CardTitle>
                <CardDescription className="flex min-w-0 flex-col gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <PenTool className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="min-w-0 break-words">
                      {mission.createdByName}さんがグッジョブしました
                    </span>
                  </div>
                  {(mission.praisedUsers.length > 0 ||
                    (mission.praisedExternalUsers &&
                      mission.praisedExternalUsers.length > 0)) && (
                    <div className="flex min-w-0 items-start gap-2">
                      <User className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span className="min-w-0 break-words">
                        {[
                          ...mission.praisedUsers,
                          ...(mission.praisedExternalUsers || []).map(
                            (name) => `${name}`,
                          ),
                        ].join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="flex min-w-0 items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span className="min-w-0">
                      {formatDate(mission.createdAt)}
                    </span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 flex-1 p-4 pt-0 md:p-6 md:pt-0">
                {/* 画像表示 */}
                {mission.imagePaths && mission.imagePaths.length > 0 && (
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {mission.imagePaths.slice(0, 3).map((path) => {
                      const supabase = createClient();
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
                  {mission.content}
                </p>
                <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                  {mission.mvvItems.passionateExecution && (
                    <Badge variant="secondary">夢中になってやりきる</Badge>
                  )}
                  {mission.mvvItems.supremeRelationships && (
                    <Badge variant="secondary">至高な人間関係</Badge>
                  )}
                  {mission.mvvItems.happinessCirculation && (
                    <Badge variant="secondary">幸せの循環</Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex min-w-0 flex-col gap-2 p-4 pt-0 md:flex-row md:items-center md:justify-between md:p-6 md:pt-0">
                <LikeButton
                  missionId={mission.id}
                  initialLiked={mission.isLikedByCurrentUser || false}
                  initialCount={mission.likesCount}
                  isOwnMission={currentUserId === mission.createdBy}
                  isExpired={isLikeExpired(mission.publishedAt ?? null)}
                />
                <Link
                  href={`/user-missions/${mission.id}`}
                  className="w-full md:w-auto"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full md:w-auto"
                  >
                    詳細を見る
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
