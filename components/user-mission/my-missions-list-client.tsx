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
import {
  Calendar,
  CheckCircle,
  Clock,
  Heart,
  Plus,
  Search,
  User,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type UserMission = {
  id: string;
  createdBy: string;
  title: string;
  content: string;
  imagePaths?: string[];
  praisedUsers: string[];
  praisedExternalUsers?: string[];
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  publicMissionId?: string;
  likesCount: number;
  mvvItems: {
    passionateExecution: boolean;
    supremeRelationships: boolean;
    happinessCirculation: boolean;
  };
  isLikedByCurrentUser: boolean;
};

export function MyMissionsListClient({
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
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="mr-1 h-3 w-3" />
            下書き
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default">
            <CheckCircle className="mr-1 h-3 w-3" />
            承認済み
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            却下
          </Badge>
        );
      default:
        return null;
    }
  };

  // フィルタリング
  const filteredMissions = useMemo(() => {
    let filtered = missions;

    // ステータスフィルタリング
    if (statusFilter !== "all") {
      filtered = filtered.filter((mission) => mission.status === statusFilter);
    }

    // ユーザー名検索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((mission) => {
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
  }, [
    missions,
    searchQuery,
    selectedYear,
    selectedMonth,
    selectedMvvItems,
    statusFilter,
  ]);

  // 下書きと公開済みを分離
  const drafts = filteredMissions.filter((m) => m.status === "pending");
  const published = filteredMissions.filter((m) => m.status !== "pending");

  const renderMissionCard = (mission: UserMission) => {
    const supabase = createClient();
    return (
      <Card key={mission.id} className="flex flex-col">
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <CardTitle className="line-clamp-2 flex-1">
              {mission.title}
            </CardTitle>
            {getStatusBadge(mission.status)}
          </div>
          <CardDescription className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {mission.praisedUsers.length > 0 ||
            (mission.praisedExternalUsers &&
              mission.praisedExternalUsers.length > 0)
              ? [
                  ...mission.praisedUsers,
                  ...(mission.praisedExternalUsers || []),
                ].join(", ")
              : "（未選択）"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
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
          <p className="text-sm text-muted-foreground line-clamp-3">
            {mission.content || "（内容未入力）"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
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
        <CardFooter className="flex justify-between items-center">
          {mission.status === "approved" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {mission.likesCount > 10 && (
                <svg
                  width="0"
                  height="0"
                  className="absolute"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id={`rainbow-gradient-my-${mission.id}`}
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#ff0000" />
                      <stop offset="14.28%" stopColor="#ff7f00" />
                      <stop offset="28.57%" stopColor="#ffff00" />
                      <stop offset="42.85%" stopColor="#00ff00" />
                      <stop offset="57.14%" stopColor="#0000ff" />
                      <stop offset="71.42%" stopColor="#4b0082" />
                      <stop offset="85.71%" stopColor="#9400d3" />
                      <stop offset="100%" stopColor="#ff0000" />
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
                        fill: `url(#rainbow-gradient-my-${mission.id})`,
                        filter:
                          "drop-shadow(0 0 4px rgba(255, 0, 0, 0.6)) drop-shadow(0 0 8px rgba(255, 127, 0, 0.4)) drop-shadow(0 0 12px rgba(255, 255, 0, 0.3))",
                      }
                    : undefined
                }
              />
              <span
                className={cn(
                  mission.likesCount > 10 && "text-rainbow font-semibold",
                )}
              >
                {mission.likesCount}
              </span>
            </div>
          )}
          {mission.status === "pending" ? (
            <Link
              href={`/user-missions/${mission.id}/edit`}
              className="ml-auto"
            >
              <Button variant="default" size="sm">
                編集する
              </Button>
            </Link>
          ) : (
            <Link href={`/user-missions/${mission.id}`} className="ml-auto">
              <Button variant="ghost" size="sm">
                詳細を見る
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    );
  };

  if (missions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          まだグッジョブを作成していません
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
    <div className="space-y-6">
      {/* 検索フィールド */}
      <div className="space-y-4">
        {/* ステータスフィルタ */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="ステータスで絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="pending">下書き</SelectItem>
              <SelectItem value="approved">承認済み</SelectItem>
              <SelectItem value="rejected">却下</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
          selectedMvvItems.size > 0 ||
          statusFilter !== "all") && (
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
        selectedMvvItems.size > 0 ||
        statusFilter !== "all") ? (
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
              setStatusFilter("all");
            }}
          >
            検索をクリア
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 下書きセクション */}
          {drafts.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">下書き</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {drafts.map(renderMissionCard)}
              </div>
            </div>
          )}

          {/* 公開済みセクション */}
          {published.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">公開済み</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {published.map(renderMissionCard)}
              </div>
            </div>
          )}

          {/* 下書きも公開済みもない場合 */}
          {drafts.length === 0 && published.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                まだグッジョブを作成していません
              </p>
              <Link href="/user-missions/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  最初のグッジョブを作成
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
