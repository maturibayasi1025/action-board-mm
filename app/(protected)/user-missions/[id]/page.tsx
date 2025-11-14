import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LikeButton } from "@/components/user-mission/like-button";
import { createClient } from "@/lib/supabase/server";
import type { Like, MvvItem, PraisedUser } from "@/lib/types/user-missions";
import { Calendar, User } from "lucide-react";
import { notFound } from "next/navigation";

export const runtime = "edge";

async function getUserMissionById(id: string) {
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
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  // 作成者情報を別途取得
  const { data: userProfile } = await supabase
    .from("private_users")
    .select("name")
    .eq("id", data.created_by)
    .single();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    id: data.id,
    createdBy: data.created_by,
    createdByName: userProfile?.name || "不明なユーザー",
    title: data.title,
    content: data.content,
    praisedUsers:
      data.user_mission_praised_users
        ?.map((p) => (p as unknown as PraisedUser).private_users?.name)
        .filter(Boolean) || [],
    status: data.status,
    rejectionReason: data.rejection_reason,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    approvedAt: data.approved_at,
    approvedBy: data.approved_by,
    publicMissionId: data.public_mission_id,
    likesCount: data.likes_count,
    mvvItems: {
      passionateExecution:
        data.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "passionate_execution",
        ) || false,
      supremeRelationships:
        data.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "supreme_relationships",
        ) || false,
      happinessCirculation:
        data.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "happiness_circulation",
        ) || false,
    },
    isLikedByCurrentUser: user
      ? data.user_mission_likes?.some(
          (like: Like) => like.user_id === user.id,
        ) || false
      : false,
  };
}

export default async function UserMissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mission = await getUserMissionById(id);

  if (!mission) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-4">{mission.title}</CardTitle>
              <CardDescription>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>賞賛対象: {mission.praisedUsers.join(", ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      作成日:{" "}
                      {new Date(mission.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    作成者: {mission.createdByName}
                  </div>
                </div>
              </CardDescription>
            </div>
            <div className="ml-4">
              <LikeButton
                missionId={mission.id}
                initialLiked={mission.isLikedByCurrentUser}
                initialCount={mission.likesCount}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">詳細内容</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {mission.content}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">MVV項目</h3>
              <div className="flex flex-wrap gap-2">
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
            </div>

            {mission.status === "rejected" && mission.rejectionReason && (
              <div className="bg-destructive/10 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-destructive">
                  却下理由
                </h3>
                <p className="text-sm">{mission.rejectionReason}</p>
              </div>
            )}

            {mission.likesCount >= 10 && (
              <div className="bg-primary/10 p-4 rounded-lg">
                <p className="text-sm font-medium">
                  🎉 このグッジョブは{mission.likesCount}いいねを獲得し、
                  作成者にボーナスXPが付与されました！
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
