import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PraisedMissionsListClient } from "@/components/user-mission/praised-missions-list-client";
import { createClient } from "@/lib/supabase/server";
import type { Like, MvvItem, PraisedUser } from "@/lib/types/user-missions";
import { Suspense } from "react";

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
    .order("published_at", { ascending: false, nullsFirst: false });

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
        .filter((name): name is string => Boolean(name)) || [],
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
    <div className="container mx-auto py-8 px-4 md:px-0">
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
