import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserMissionList } from "@/components/user-mission/UserMissionList";
import { getUserMissionsServer } from "@/lib/services/userMissions";
import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const runtime = "edge";

async function MyMissionsList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>ログインが必要です</div>;
  }

  const missions = await getUserMissionsServer({ createdBy: user.id });

  return <UserMissionList missions={missions} filterMode="my" />;
}

export default function MyUserMissionsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">マイグッジョブ</h1>
          <p className="text-muted-foreground mt-2">
            自分が作成したグッジョブを管理できます
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
            {Array.from({ length: 3 }, (_, i) => (
              <Card
                key={`skeleton-my-missions-${i}`}
                className="h-[300px] animate-pulse"
              >
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
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
