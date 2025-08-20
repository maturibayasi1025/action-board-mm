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
import { LikeButton } from "@/components/user-mission/like-button";
import { createClient } from "@/lib/supabase/server";
import type { Like, MvvItem, PraisedUser } from "@/lib/types/user-missions";
import { Heart, Plus, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

async function getUserMissionsServer() {
  const supabase = await createClient();

  // 作成者名を含むビューから取得
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
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching user missions:", error);
    return [];
  }

  if (!data) return [];

  console.log("Fetched missions:", data.length, "missions");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 作成者名を取得
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
        ?.map((p) => (p as unknown as PraisedUser).private_users?.name)
        .filter(Boolean) || [],
    status: mission.status,
    rejectionReason: mission.rejection_reason,
    createdAt: mission.created_at,
    updatedAt: mission.updated_at,
    approvedAt: mission.approved_at,
    approvedBy: mission.approved_by,
    publicMissionId: mission.public_mission_id,
    likesCount: mission.likes_count,
    mvvItems: {
      passionateExecution:
        mission.user_mission_mvv_items?.some(
          (item) =>
            (item as unknown as MvvItem).mvv_type === "passionate_execution",
        ) || false,
      supremeRelationships:
        mission.user_mission_mvv_items?.some(
          (item) =>
            (item as unknown as MvvItem).mvv_type === "supreme_relationships",
        ) || false,
      happinessCirculation:
        mission.user_mission_mvv_items?.some(
          (item) =>
            (item as unknown as MvvItem).mvv_type === "happiness_circulation",
        ) || false,
    },
    isLikedByCurrentUser: user
      ? mission.user_mission_likes?.some(
          (like) => (like as unknown as Like).user_id === user.id,
        ) || false
      : false,
  }));
}

async function UserMissionsList() {
  const missions = await getUserMissionsServer();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {missions.map((mission) => (
        <Card key={mission.id} className="flex flex-col">
          <CardHeader>
            <CardTitle className="line-clamp-2">{mission.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {mission.praisedUsers.join(", ")}
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
  );
}

export default function UserMissionsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">ユーザーグッジョブ</h1>
          <p className="text-muted-foreground mt-2">
            みんなが作成した賞賛グッジョブを見てみましょう
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
                key={`skeleton-card-user-missions-${i}`}
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
        <UserMissionsList />
      </Suspense>
    </div>
  );
}
