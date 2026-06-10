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
import { getUserMissionsServer } from "@/lib/services/userMissions";
import { createClient } from "@/lib/supabase/server";
import { isLikeExpired } from "@/lib/utils/user-mission-likes";
import { ArrowRight, PenTool, Plus, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

async function UserMissionsList() {
  try {
    const featuredMissions = await getUserMissionsServer({ limit: 6 });
    const supabase = await createClient();
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
        <div className="grid gap-4 px-4 md:gap-6 md:px-0 md:grid-cols-2 lg:grid-cols-3">
          {featuredMissions.map((mission) => (
            <Card key={mission.id} className="flex h-full min-w-0 flex-col">
              <CardHeader className="min-w-0 p-4 md:p-6">
                <CardTitle className="line-clamp-2 min-w-0 break-words text-lg">
                  {mission.title}
                </CardTitle>
                <div className="min-w-0 space-y-1">
                  <CardDescription className="flex min-w-0 items-start gap-2">
                    <PenTool className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="min-w-0 break-words">
                      {mission.createdByName}さんがグッジョブしました
                    </span>
                  </CardDescription>
                  {(mission.praisedUsers.length > 0 ||
                    (mission.praisedExternalUsers &&
                      mission.praisedExternalUsers.length > 0)) && (
                    <CardDescription className="flex min-w-0 items-start gap-2">
                      <User className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span className="min-w-0 break-words">
                        {[
                          ...mission.praisedUsers,
                          ...(mission.praisedExternalUsers || []),
                        ].join(", ")}
                      </span>
                    </CardDescription>
                  )}
                </div>
              </CardHeader>
              <CardContent className="min-w-0 flex-1 p-4 pt-0 md:p-6 md:pt-0">
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
                <p className="line-clamp-3 min-w-0 break-words text-sm text-muted-foreground">
                  {mission.content}
                </p>
                <div className="mt-4 flex min-w-0 flex-wrap gap-2">
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
              <CardFooter className="flex min-w-0 flex-col gap-2 p-4 pt-0 md:flex-row md:items-center md:justify-between md:p-6 md:pt-0">
                <LikeButton
                  missionId={mission.id}
                  initialLiked={mission.isLikedByCurrentUser || false}
                  initialCount={mission.likesCount}
                  isOwnMission={user?.id === mission.createdBy}
                  isExpired={isLikeExpired(mission.publishedAt)}
                />
                <Link
                  href={`/user-missions/${mission.id}`}
                  className="w-full md:w-auto"
                >
                  <Button variant="ghost" size="sm" className="w-full md:w-auto">
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
          key={`skeleton-card-top-section-${i}`}
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
