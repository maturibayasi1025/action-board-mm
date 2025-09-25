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
import { ArrowRight, Plus, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

async function getUserMissionsServer() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("user_missions")
      .select(`
        id,
        created_by,
        title,
        content,
        status,
        rejection_reason,
        created_at,
        updated_at,
        approved_at,
        approved_by,
        public_mission_id,
        likes_count
      `)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("Error fetching user missions:", error);
      return [];
    }

    if (!data) return [];

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const results = [];

    for (const mission of data) {
      try {
        // MVV項目を個別に取得
        const { data: mvvItems, error: mvvError } = await supabase
          .from("user_mission_mvv_items")
          .select("mvv_type")
          .eq("user_mission_id", mission.id);

        if (mvvError) {
          console.error(`MVV error for mission ${mission.id}:`, mvvError);
        }

        // 賞賛対象ユーザーを個別に取得
        const { data: praisedUsers, error: praisedError } = await supabase
          .from("user_mission_praised_users")
          .select(`
            praised_user_id,
            private_users!praised_user_id (
              name
            )
          `)
          .eq("user_mission_id", mission.id);

        if (praisedError) {
          console.error(
            `Praised users error for mission ${mission.id}:`,
            praisedError,
          );
        }

        // いいね情報を個別に取得
        const { data: likes, error: likesError } = await supabase
          .from("user_mission_likes")
          .select("user_id")
          .eq("user_mission_id", mission.id);

        if (likesError) {
          console.error(`Likes error for mission ${mission.id}:`, likesError);
        }

        const missionResult = {
          id: mission.id,
          createdBy: mission.created_by,
          title: mission.title,
          content: mission.content,
          praisedUsers:
            praisedUsers
              ?.map((p) => {
                // 型安全にアクセス
                if (p && typeof p === "object" && "private_users" in p) {
                  const privateUsers = p.private_users as {
                    name?: string;
                  } | null;
                  return privateUsers?.name;
                }
                return undefined;
              })
              .filter((name): name is string => Boolean(name)) || [],
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
              mvvItems?.some(
                (item: MvvItem) => item.mvv_type === "passionate_execution",
              ) || false,
            supremeRelationships:
              mvvItems?.some(
                (item: MvvItem) => item.mvv_type === "supreme_relationships",
              ) || false,
            happinessCirculation:
              mvvItems?.some(
                (item: MvvItem) => item.mvv_type === "happiness_circulation",
              ) || false,
          },
          isLikedByCurrentUser: user
            ? likes?.some((like: Like) => like.user_id === user.id) || false
            : false,
        };

        results.push(missionResult);
      } catch (itemError) {
        console.error(`Error processing mission ${mission.id}:`, itemError);
        // エラーが発生した場合は基本情報のみで続行
        results.push({
          id: mission.id,
          createdBy: mission.created_by,
          title: mission.title,
          content: mission.content,
          praisedUsers: [],
          status: mission.status,
          rejectionReason: mission.rejection_reason,
          createdAt: mission.created_at,
          updatedAt: mission.updated_at,
          approvedAt: mission.approved_at,
          approvedBy: mission.approved_by,
          publicMissionId: mission.public_mission_id,
          likesCount: mission.likes_count || 0,
          mvvItems: {
            passionateExecution: false,
            supremeRelationships: false,
            happinessCirculation: false,
          },
          isLikedByCurrentUser: false,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error in getUserMissionsServer:", error);
    return [];
  }
}

async function UserMissionsList() {
  try {
    const featuredMissions = await getUserMissionsServer(); // ホームページでは6件まで表示

    if (featuredMissions.length === 0) {
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
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredMissions.map((mission) => (
            <Card key={mission.id} className="flex flex-col h-full">
              <CardHeader>
                <CardTitle className="line-clamp-2 text-lg">
                  {mission.title}
                </CardTitle>
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
                    <Badge variant="secondary" className="text-xs">
                      夢中になってやりきる
                    </Badge>
                  )}
                  {mission.mvvItems.supremeRelationships && (
                    <Badge variant="secondary" className="text-xs">
                      至高な人間関係
                    </Badge>
                  )}
                  {mission.mvvItems.happinessCirculation && (
                    <Badge variant="secondary" className="text-xs">
                      幸せの循環
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center pt-4">
                <LikeButton
                  missionId={mission.id}
                  initialLiked={mission.isLikedByCurrentUser || false}
                  initialCount={mission.likesCount}
                />
                <Link href={`/user-missions/${mission.id}`}>
                  <Button variant="ghost" size="sm">
                    詳細
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/user-missions">
            <Button variant="outline" size="lg">
              すべてのユーザーグッジョブを見る
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading user missions for homepage:", error);
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          ユーザーグッジョブの読み込み中にエラーが発生しました
        </p>
      </div>
    );
  }
}

function UserMissionsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Card
          key={`skeleton-card-top-section-${Date.now()}-${i}`}
          className="h-[300px] animate-pulse"
        >
          <CardHeader>
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-20 bg-muted rounded mb-4" />
            <div className="flex gap-2">
              <div className="h-6 bg-muted rounded w-20" />
              <div className="h-6 bg-muted rounded w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function UserMissionsSection() {
  return (
    <section className="py-12 md:py-16 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              🎯 ユーザーグッジョブ
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              みんなが投稿した賞賛のグッジョブ。素晴らしい行動や成果を共有し、
              お互いを讃え合いましょう。
            </p>
          </div>

          <Suspense fallback={<UserMissionsSkeleton />}>
            <UserMissionsList />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
