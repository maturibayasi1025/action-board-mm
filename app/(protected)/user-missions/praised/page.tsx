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
import { createClient } from "@/lib/supabase/server";
import type { Like, MvvItem, PraisedUser } from "@/lib/types/user-missions";
import { Heart, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const runtime = "edge";

async function getPraisedMissionsServer(userId: string) {
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

  return data.map((mission) => ({
    id: mission.id,
    createdBy: mission.created_by,
    createdByName: creatorMap.get(mission.created_by) || "不明なユーザー",
    title: mission.title,
    content: mission.content,
    praisedUsers:
      mission.user_mission_praised_users
        ?.map((p: unknown) => (p as unknown as PraisedUser).private_users?.name)
        .filter(Boolean) || [],
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

async function PraisedMissionsList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>ログインが必要です</div>;
  }

  const missions = await getPraisedMissionsServer(user.id);

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

  const renderMissionCard = (mission: (typeof missions)[0]) => (
    <Card key={mission.id} className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="line-clamp-2 flex-1">{mission.title}</CardTitle>
        </div>
        <CardDescription className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>賞賛対象: {mission.praisedUsers.join(", ")}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            作成者: {mission.createdByName}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
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

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {missions.map(renderMissionCard)}
    </div>
  );
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
