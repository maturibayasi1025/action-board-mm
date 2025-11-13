"use client";

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
import { Input } from "@/components/ui/input";
import { LikeButton } from "@/components/user-mission/like-button";
import { Plus, Search, User, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type UserMission = {
  id: string;
  createdBy: string;
  createdByName: string;
  title: string;
  content: string;
  praisedUsers: string[];
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  publicMissionId: string | null;
  likesCount: number;
  mvvItems: {
    passionateExecution: boolean;
    supremeRelationships: boolean;
    happinessCirculation: boolean;
  };
  isLikedByCurrentUser: boolean;
};

export function UserMissionsList({ missions }: { missions: UserMission[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  // 検索クエリでフィルタリング
  const filteredMissions = useMemo(() => {
    if (!searchQuery.trim()) {
      return missions;
    }

    const query = searchQuery.toLowerCase();
    return missions.filter((mission) => {
      return mission.praisedUsers.some((userName) =>
        userName.toLowerCase().includes(query),
      );
    });
  }, [missions, searchQuery]);

  if (missions.length === 0) {
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
    <>
      {/* 検索フィールド */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="賞賛されているユーザー名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-muted-foreground mt-2">
            {filteredMissions.length}件のグッジョブが見つかりました（全
            {missions.length}件）
          </p>
        )}
      </div>

      {/* 検索結果がない場合 */}
      {filteredMissions.length === 0 && searchQuery ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            「{searchQuery}」に一致するグッジョブが見つかりませんでした
          </p>
          <Button variant="outline" onClick={() => setSearchQuery("")}>
            検索をクリア
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMissions.map((mission) => (
            <Card key={mission.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="line-clamp-2">{mission.title}</CardTitle>
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
                    <Badge variant="secondary">夢中になってやりきる</Badge>
                  )}
                  {mission.mvvItems.supremeRelationships && (
                    <Badge variant="secondary">至高な人間関係</Badge>
                  )}
                  {mission.mvvItems.happinessCirculation && (
                    <Badge variant="secondary">幸せの循環</Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <LikeButton
                  missionId={mission.id}
                  initialLiked={mission.isLikedByCurrentUser || false}
                  initialCount={mission.likesCount}
                />
                <Link href={`/user-missions/${mission.id}`}>
                  <Button variant="ghost" size="sm">
                    詳細を見る
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
