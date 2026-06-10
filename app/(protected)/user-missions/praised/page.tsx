import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserMissionList } from "@/components/user-mission/UserMissionList";
import { getUserMissionsServer } from "@/lib/services/userMissions";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

export const runtime = "edge";

async function PraisedMissionsList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>ログインが必要です</div>;
  }

  const missions = await getUserMissionsServer({ praisedForUserId: user.id });

  return <UserMissionList missions={missions} filterMode="praised" />;
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
                key={`skeleton-card-praised-missions-${i}`}
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
