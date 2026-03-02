import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isOwner } from "@/lib/utils/isOwner";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAwardSurveys, getTotalUsers } from "./actions";

export const runtime = "edge";

export default async function AwardSurveysAdminPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const surveys = await getAwardSurveys();
  const totalUsers = await getTotalUsers();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">表彰アンケート管理</h1>
            <p className="text-muted-foreground">
              月次表彰アンケートの作成・管理を行います。
            </p>
          </div>
          <Link href="/admin/award-surveys/questions">
            <Button variant="outline">質問を管理</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>アンケート一覧</CardTitle>
            <CardDescription>全ユーザー数: {totalUsers}人</CardDescription>
          </CardHeader>
          <CardContent>
            {surveys.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                アンケートがまだ作成されていません。
              </p>
            ) : (
              <div className="space-y-4">
                {surveys.map((survey) => {
                  const responseRate =
                    totalUsers > 0
                      ? Math.round(
                          (survey.unique_response_count / totalUsers) * 100,
                        )
                      : 0;

                  return (
                    <Card key={survey.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">
                                {survey.title}
                              </h3>
                              {survey.is_active ? (
                                <Badge variant="default">有効</Badge>
                              ) : (
                                <Badge variant="secondary">無効</Badge>
                              )}
                            </div>
                            {survey.description && (
                              <p className="text-sm text-muted-foreground">
                                {survey.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span>対象年月: {survey.year_month}</span>
                              <span>{survey.period_number}期</span>
                              <span>
                                回答数: {survey.unique_response_count} /{" "}
                                {totalUsers} ({responseRate}%)
                              </span>
                              <span>
                                開始:{" "}
                                {new Date(survey.start_date).toLocaleDateString(
                                  "ja-JP",
                                )}
                              </span>
                              <span>
                                終了:{" "}
                                {new Date(survey.end_date).toLocaleDateString(
                                  "ja-JP",
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/award-surveys/${survey.id}`}>
                              <Button variant="outline" size="sm">
                                集計を見る
                              </Button>
                            </Link>
                            <Link href={`/surveys/award/${survey.id}`}>
                              <Button variant="ghost" size="sm">
                                回答画面
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
