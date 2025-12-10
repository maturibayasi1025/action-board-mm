import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserMissionsList } from "@/components/user-mission/user-missions-list";
import { createClient } from "@/lib/supabase/server";
import type { Like, MvvItem, PraisedUser } from "@/lib/types/user-missions";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const runtime = "edge";

async function UserMissionsListWrapper() {
  const missions = await getUserMissionsServer();
  return <UserMissionsList missions={missions} />;
}

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
          name,
          x_username
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
    createdByName: creatorMap.get(mission.created_by) || "不明なユーザー",
    title: mission.title,
    content: mission.content,
    imagePaths: ((mission as unknown as { image_paths?: string[] })
      .image_paths || []) as string[],
    praisedUsers:
      mission.user_mission_praised_users
        ?.map((p: PraisedUser) => p.private_users?.name)
        .filter((name: string | undefined): name is string => Boolean(name)) ||
      [],
    praisedUsersWithXUsername:
      mission.user_mission_praised_users
        ?.map((p: PraisedUser) => ({
          name: p.private_users?.name || "",
          x_username: p.private_users?.x_username ?? null,
        }))
        .filter((user: { name: string; x_username: string | null }) =>
          Boolean(user.name),
        ) || [],
    praisedExternalUsers: externalUsersMap.get(mission.id) || [],
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

export default function UserMissionsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">ユーザーグッジョブ</h1>
          <p className="text-muted-foreground mt-2">
            みんなが作成した賞賛グッジョブを見てみましょう
          </p>
        </div>
        <Link href="/user-missions/new">
          <Button className="w-full md:w-auto">
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
                key={`skeleton-card-user-missions-${Date.now()}-${i}`}
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
        <UserMissionsListWrapper />
      </Suspense>
    </div>
  );
}
