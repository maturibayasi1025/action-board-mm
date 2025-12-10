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
import { ArrowRight, PenTool, Plus, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

async function getUserMissionsServer() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("user_missions")
      .select("*")
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

    // 作成者名を一括取得
    const creatorIds = Array.from(
      new Set(data.map((m) => (m as { created_by: string }).created_by)),
    );
    const { data: creators } = await supabase
      .from("private_users")
      .select("id, name")
      .in("id", creatorIds);

    const creatorMap = new Map(creators?.map((c) => [c.id, c.name]) || []);

    const results = [];

    for (const mission of data) {
      try {
        // MVV項目を個別に取得
        const missionId = (mission as { id: string }).id;
        const { data: mvvItems, error: mvvError } = await supabase
          .from("user_mission_mvv_items")
          .select("mvv_type")
          .eq("user_mission_id", missionId);

        if (mvvError) {
          console.error(`MVV error for mission ${missionId}:`, mvvError);
        }

        // ログインしている場合のみ賞賛対象ユーザーを取得
        let praisedUsers = null;
        let praisedExternalUsers = null;

        if (user) {
          // 賞賛対象ユーザーを個別に取得
          const { data: praisedUsersData, error: praisedError } = await supabase
            .from("user_mission_praised_users")
            .select(`
              praised_user_id,
              private_users!praised_user_id (
                name
              )
            `)
            .eq("user_mission_id", missionId);

          if (praisedError) {
            console.error(
              `Praised users error for mission ${missionId}:`,
              praisedError,
            );
          }

          praisedUsers = praisedUsersData;

          // 外部ユーザー（メンバー以外）を個別に取得
          const {
            data: praisedExternalUsersData,
            error: praisedExternalError,
          } = await supabase
            .from("user_mission_praised_external_users")
            .select("praised_person_name")
            .eq("user_mission_id", missionId);

          if (praisedExternalError) {
            console.error(
              `Praised external users error for mission ${missionId}:`,
              praisedExternalError,
            );
          }

          praisedExternalUsers = praisedExternalUsersData;
        }

        // いいね情報を個別に取得
        const { data: likes, error: likesError } = await supabase
          .from("user_mission_likes")
          .select("user_id")
          .eq("user_mission_id", mission.id);

        if (likesError) {
          console.error(`Likes error for mission ${missionId}:`, likesError);
        }

        const missionTyped = mission as {
          id: string;
          created_by: string;
          title: string;
          content: string;
          status: string;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          approved_by: string | null;
          public_mission_id: string | null;
          likes_count: number;
          image_paths?: string[] | null;
        };
        const missionResult = {
          id: missionTyped.id,
          createdBy: missionTyped.created_by,
          createdByName:
            creatorMap.get(missionTyped.created_by) || "不明なユーザー",
          title: missionTyped.title,
          content: missionTyped.content,
          imagePaths: ((missionTyped.image_paths as string[]) ||
            []) as string[],
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
              .filter((name: string | undefined): name is string =>
                Boolean(name),
              ) || [],
          praisedExternalUsers:
            praisedExternalUsers?.map(
              (p: { praised_person_name: string }) => p.praised_person_name,
            ) || [],
          status: missionTyped.status,
          rejectionReason: missionTyped.rejection_reason,
          createdAt: missionTyped.created_at,
          updatedAt: missionTyped.updated_at,
          approvedAt: missionTyped.approved_at,
          approvedBy: missionTyped.approved_by,
          publicMissionId: missionTyped.public_mission_id,
          likesCount: missionTyped.likes_count,
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
        const missionTyped = mission as {
          id: string;
          created_by: string;
          title: string;
          content: string;
          status: string;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          approved_by: string | null;
          public_mission_id: string | null;
          likes_count: number;
          image_paths?: string[] | null;
        };
        console.error(
          `Error processing mission ${missionTyped.id}:`,
          itemError,
        );
        // エラーが発生した場合は基本情報のみで続行
        results.push({
          id: missionTyped.id,
          createdBy: missionTyped.created_by,
          createdByName:
            creatorMap.get(missionTyped.created_by) || "不明なユーザー",
          title: missionTyped.title,
          content: missionTyped.content,
          imagePaths: ((missionTyped.image_paths as string[]) ||
            []) as string[],
          praisedUsers: [],
          praisedExternalUsers: [],
          status: missionTyped.status,
          rejectionReason: missionTyped.rejection_reason,
          createdAt: missionTyped.created_at,
          updatedAt: missionTyped.updated_at,
          approvedAt: missionTyped.approved_at,
          approvedBy: missionTyped.approved_by,
          publicMissionId: missionTyped.public_mission_id,
          likesCount: missionTyped.likes_count || 0,
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
    const supabase = await createClient();

    // 現在のユーザーIDを取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
                <div className="space-y-1">
                  <CardDescription className="flex items-center gap-2">
                    <PenTool className="h-4 w-4" />
                    {mission.createdByName}さんがグッジョブしました
                  </CardDescription>
                  {(mission.praisedUsers.length > 0 ||
                    (mission.praisedExternalUsers &&
                      mission.praisedExternalUsers.length > 0)) && (
                    <CardDescription className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {[
                        ...mission.praisedUsers,
                        ...(mission.praisedExternalUsers || []),
                      ].join(", ")}
                    </CardDescription>
                  )}
                </div>
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
              <CardFooter className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center pt-4">
                <LikeButton
                  missionId={mission.id}
                  initialLiked={mission.isLikedByCurrentUser || false}
                  initialCount={mission.likesCount}
                  isOwnMission={user?.id === mission.createdBy}
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
