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
import { createClient as createClientClient } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type { Like, MvvItem, PraisedUser } from "@/lib/types/user-missions";
import { Calendar, Heart, Search, User, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";

export const runtime = "edge";

type UserMission = {
  id: string;
  createdBy: string;
  createdByName: string;
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

async function getPraisedMissionsServer(
  userId: string,
): Promise<UserMission[]> {
  const supabase = await createClient();

  // まず、自分宛のグッジョブIDを取得
  const { data: praisedMissionsData, error: praisedError } = await supabase
    .from("user_mission_praised_users")
    .select("user_mission_id")
    .eq("praised_user_id", userId);

  if (praisedError) {
    console.error("Error fetching praised mission IDs:", praisedError);
    return [];
  }

  if (!praisedMissionsData || praisedMissionsData.length === 0) {
    return [];
  }

  const missionIds = praisedMissionsData.map((p) => p.user_mission_id);

  // 次に、それらのグッジョブの詳細情報を取得
  const { data, error } = await supabase
    .from("user_missions")
    .select(`
      *,
      user_mission_mvv_items (
        mvv_type
      ),
      user_mission_likes (
        user_id
      ),
      user_mission_praised_users (
        praised_user_id,
        private_users!praised_user_id (
          name
        )
      )
    `)
    .in("id", missionIds)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching praised missions:", error);
    return [];
  }

  if (!data) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 作成者情報を取得
  const creatorIds = Array.from(new Set(data.map((m) => m.created_by)));
  const { data: creators } = await supabase
    .from("private_users")
    .select("id, name")
    .in("id", creatorIds);

  const creatorMap = new Map(creators?.map((c) => [c.id, c.name]) || []);

  // 外部ユーザーを一括取得
  const dataMissionIds = data.map((m) => m.id);
  const { data: allExternalUsers, error: externalUsersError } = await supabase
    .from("user_mission_praised_external_users")
    .select("user_mission_id, praised_person_name")
    .in("user_mission_id", dataMissionIds);

  if (externalUsersError) {
    console.error("Error fetching external users:", externalUsersError);
  }

  // ミッションIDごとに外部ユーザーをグループ化
  const externalUsersMap = new Map<string, string[]>();
  if (allExternalUsers) {
    for (const eu of allExternalUsers) {
      const missionId = eu.user_mission_id;
      if (!externalUsersMap.has(missionId)) {
        externalUsersMap.set(missionId, []);
      }
      externalUsersMap.get(missionId)?.push(eu.praised_person_name);
    }
  }

  return data.map((mission) => ({
    id: mission.id,
    createdBy: mission.created_by,
    createdByName: creatorMap.get(mission.created_by) || "不明なユーザー",
    title: mission.title,
    content: mission.content,
    imagePaths: ((mission as unknown as { image_paths?: string[] })
      .image_paths || []) as string[],
    praisedUsers:
      mission.user_mission_praised_users
        ?.map((p: unknown) => (p as unknown as PraisedUser).private_users?.name)
        .filter(Boolean) || [],
    praisedExternalUsers: externalUsersMap.get(mission.id) || [],
    status: mission.status as "pending" | "approved" | "rejected",
    rejectionReason: mission.rejection_reason || undefined,
    createdAt: mission.created_at,
    updatedAt: mission.updated_at,
    approvedAt: mission.approved_at || undefined,
    approvedBy: mission.approved_by || undefined,
    publicMissionId: mission.public_mission_id || undefined,
    likesCount: mission.likes_count,
    mvvItems: {
      passionateExecution:
        mission.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "passionate_execution",
        ) || false,
      supremeRelationships:
        mission.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "supreme_relationships",
        ) || false,
      happinessCirculation:
        mission.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "happiness_circulation",
        ) || false,
    },
    isLikedByCurrentUser: user
      ? mission.user_mission_likes?.some(
          (like: Like) => like.user_id === user.id,
        ) || false
      : false,
  }));
}

function PraisedMissionsListClient({ missions }: { missions: UserMission[] }) {
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
        const createdByNameMatch = mission.createdByName
          .toLowerCase()
          .includes(query);
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
    const supabase = createClientClient();
    return (
      <Card key={mission.id} className="flex flex-col">
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <CardTitle className="line-clamp-2 flex-1">
              {mission.title}
            </CardTitle>
          </div>
          <CardDescription className="flex flex-col gap-2">
            {(mission.praisedUsers.length > 0 ||
              (mission.praisedExternalUsers &&
                mission.praisedExternalUsers.length > 0)) && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>
                  賞賛対象:{" "}
                  {[
                    ...mission.praisedUsers,
                    ...(mission.praisedExternalUsers || []),
                  ].join(", ")}
                </span>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              作成者: {mission.createdByName}
            </div>
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4" />
            {mission.likesCount}
          </div>
          <Link href={`/user-missions/${mission.id}`} className="ml-auto">
            <Button variant="ghost" size="sm">
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMissions.map(renderMissionCard)}
        </div>
      )}
    </div>
  );
}

async function PraisedMissionsList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>ログインが必要です</div>;
  }

  const missions = await getPraisedMissionsServer(user.id);

  return <PraisedMissionsListClient missions={missions} />;
}

export default function PraisedUserMissionsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">自分宛のグッジョブ</h1>
        <p className="text-muted-foreground mt-2">
          あなた宛に送られたグッジョブの一覧
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Card
                key={`skeleton-card-praised-missions-${Date.now()}-${i}`}
                className="h-[300px] animate-pulse"
              >
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <PraisedMissionsList />
      </Suspense>
    </div>
  );
}
