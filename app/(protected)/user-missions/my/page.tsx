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

  return data.map((mission) => ({
    id: mission.id,
    createdBy: mission.created_by,
    title: mission.title,
    content: mission.content,
    praisedUsers:
      mission.user_mission_praised_users
        ?.map((p) => (p as unknown as PraisedUser).private_users?.name)
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
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            承認待ち
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

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {missions.map((mission) => (
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
              {mission.praisedUsers.join(", ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {mission.content}
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
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            {mission.status === "approved" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Heart className="h-4 w-4" />
                {mission.likesCount}
              </div>
            )}
            <Link href={`/user-missions/${mission.id}`} className="ml-auto">
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
                key={`skeleton-card-my-missions-${i}`}
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
