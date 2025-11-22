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
import { CheckCircle, Clock, Heart, Plus, User, XCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const runtime = "edge";

async function getUserMissionsServer(userId: string) {
  const supabase = await createClient();

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
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching user missions:", error);
    return [];
  }

  if (!data) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 外部ユーザーを一括取得
  const missionIds = data.map((m) => m.id);
  const { data: allExternalUsers, error: externalUsersError } = await supabase
    .from("user_mission_praised_external_users")
    .select("user_mission_id, praised_person_name")
    .in("user_mission_id", missionIds);

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
    title: mission.title,
    content: mission.content,
    imagePaths: (mission.image_paths as string[]) || [],
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

async function MyMissionsList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>ログインが必要です</div>;
  }

  const missions = await getUserMissionsServer(user.id);

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

  // 下書きと公開済みを分離
  const drafts = missions.filter((m) => m.status === "pending");
  const published = missions.filter((m) => m.status !== "pending");

  const renderMissionCard = (mission: (typeof missions)[0]) => (
    <Card key={mission.id} className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="line-clamp-2 flex-1">{mission.title}</CardTitle>
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
            <Heart className="h-4 w-4" />
            {mission.likesCount}
          </div>
        )}
        {mission.status === "pending" ? (
          <Link href={`/user-missions/${mission.id}/edit`} className="ml-auto">
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

  return (
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
  );
}

export default function MyUserMissionsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">マイグッジョブ</h1>
          <p className="text-muted-foreground mt-2">
            あなたが作成したグッジョブの一覧
          </p>
        </div>
        <Link href="/user-missions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            グッジョブを作成
          </Button>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Card
                key={`skeleton-card-my-missions-${Date.now()}-${i}`}
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
        <MyMissionsList />
      </Suspense>
    </div>
  );
}
