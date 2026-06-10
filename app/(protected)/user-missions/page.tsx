import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserMissionList } from "@/components/user-mission/UserMissionList";
import { getUserMissionsServer } from "@/lib/services/userMissions";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const runtime = "edge";

async function UserMissionsListWrapper() {
  const missions = await getUserMissionsServer();
  return <UserMissionList missions={missions} filterMode="all" />;
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
        <UserMissionsListWrapper />
      </Suspense>
    </div>
  );
}
