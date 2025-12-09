import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MyMissionsListClient } from "@/components/user-mission/my-missions-list-client";
import { createClient } from "@/lib/supabase/server";
import type { Like, MvvItem, PraisedUser } from "@/lib/types/user-missions";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const runtime = "edge";

type UserMission = {
  id: string;
  createdBy: string;
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

async function getUserMissionsServer(userId: string): Promise<UserMission[]> {
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

async function MyMissionsList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>ログインが必要です</div>;
  }

  const missions = await getUserMissionsServer(user.id);

  return <MyMissionsListClient missions={missions} />;
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
