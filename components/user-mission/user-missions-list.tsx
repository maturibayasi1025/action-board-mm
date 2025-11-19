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
import { Calendar, PenTool, Plus, Search, User, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type UserMission = {
  id: string;
  createdBy: string;
  createdByName: string;
  title: string;
  content: string;
  praisedUsers: string[];
  praisedExternalUsers?: string[];
  praisedUsersWithXUsername?: Array<{
    name: string;
    x_username: string | null;
  }>;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  publicMissionId: string | null;
  likesCount: number;
  mvvItems: {
    passionateExecution: boolean;
    supremeRelationships: boolean;
    happinessCirculation: boolean;
  };
  isLikedByCurrentUser: boolean;
};

export function UserMissionsList({ missions }: { missions: UserMission[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

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

    return filtered;
  }, [missions, searchQuery, selectedYear, selectedMonth]);

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
        <div className="flex items-center gap-2">
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

        {/* 検索結果件数表示 */}
        {(searchQuery || selectedYear !== "all" || selectedMonth !== "all") && (
          <p className="text-sm text-muted-foreground">
            {filteredMissions.length}件のグッジョブが見つかりました（全
            {missions.length}件）
          </p>
        )}
      </div>

      {/* 検索結果がない場合 */}
      {filteredMissions.length === 0 &&
      (searchQuery || selectedYear !== "all" || selectedMonth !== "all") ? (
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
            }}
          >
            検索をクリア
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMissions.map((mission) => (
            <Card key={mission.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="line-clamp-2">{mission.title}</CardTitle>
                <CardDescription className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4" />
                    {mission.createdByName}さんがグッジョブしました
                  </div>
                  {(mission.praisedUsers.length > 0 ||
                    (mission.praisedExternalUsers &&
                      mission.praisedExternalUsers.length > 0)) && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>
                        {[
                          ...mission.praisedUsers,
                          ...(mission.praisedExternalUsers || []).map(
                            (name) => `${name}`,
                          ),
                        ].join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3" />
                    {formatDate(mission.createdAt)}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {mission.content}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
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
              <CardFooter className="flex justify-between items-center">
                <LikeButton
                  missionId={mission.id}
                  initialLiked={mission.isLikedByCurrentUser || false}
                  initialCount={mission.likesCount}
                />
                <Link href={`/user-missions/${mission.id}`}>
                  <Button variant="ghost" size="sm">
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
