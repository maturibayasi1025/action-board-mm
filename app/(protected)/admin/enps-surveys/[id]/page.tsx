import { SurveyResponsesPanel } from "@/components/admin/survey-responses-panel";
import { UnansweredSlackReminder } from "@/components/admin/unanswered-slack-reminder";
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
import {
  getAllSurveysNps,
  getSurveyDetail,
  getSurveyResponses,
  getUnansweredUsers,
} from "./actions";

export const runtime = "edge";

interface SurveyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SurveyDetailPage({
  params,
}: SurveyDetailPageProps) {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const { id } = await params;
  const survey = await getSurveyDetail(id);
  const { questions, responses, npsData } = await getSurveyResponses(id);
  const unansweredUsers = await getUnansweredUsers(id);
  const allSurveysNps = await getAllSurveysNps();

  if (!survey) {
    redirect("/admin/enps-surveys");
  }

  const scoreQuestions = questions.filter(
    (q) => q.question_type === "score_0_10",
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{survey.title}</h1>
            <p className="text-muted-foreground">
              対象年月: {survey.year_month} | 回答数: {responses.length}件
            </p>
          </div>
          <Link href="/admin/enps-surveys">
            <Button variant="outline">一覧に戻る</Button>
          </Link>
        </div>

        {/* NPSスコア */}
        {scoreQuestions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scoreQuestions.map((question) => {
              const nps = npsData[question.id];
              if (!nps || !nps.scores || nps.scores.length === 0) {
                return (
                  <Card key={question.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {question.question_text}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        まだ回答がありません。
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card key={question.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {question.question_text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold">
                        {nps.nps > 0 ? "+" : ""}
                        {nps.nps}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">NPS</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-semibold text-green-600">
                          {nps.promoters}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          推奨者 (9-10点)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {nps.scores.length > 0
                            ? Math.round(
                                (nps.promoters / nps.scores.length) * 100,
                              )
                            : 0}
                          %
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-semibold text-yellow-600">
                          {nps.passives}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          中立者 (7-8点)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {nps.scores.length > 0
                            ? Math.round(
                                (nps.passives / nps.scores.length) * 100,
                              )
                            : 0}
                          %
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-semibold text-red-600">
                          {nps.detractors}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          批判者 (0-6点)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {nps.scores.length > 0
                            ? Math.round(
                                (nps.detractors / nps.scores.length) * 100,
                              )
                            : 0}
                          %
                        </div>
                      </div>
                    </div>
                    {/* スコア分布 */}
                    {nps.scores.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">スコア分布</div>
                        <div className="flex items-end gap-1 h-32 border-b border-gray-200 pb-1">
                          {([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(
                            (scoreValue) => {
                              const count = nps.scores.filter(
                                (s) => s === scoreValue,
                              ).length;
                              const maxCount = Math.max(
                                ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                                  (j) =>
                                    nps.scores.filter((s) => s === j).length,
                                ),
                                1,
                              );
                              const height =
                                maxCount > 0 ? (count / maxCount) * 100 : 0;
                              return (
                                <div
                                  key={`score-${scoreValue}`}
                                  className="flex-1 flex flex-col items-center gap-1 justify-end"
                                >
                                  {count > 0 && (
                                    <div className="text-xs text-muted-foreground mb-1">
                                      {count}
                                    </div>
                                  )}
                                  <div
                                    className="w-full bg-primary rounded-t transition-all min-h-[2px]"
                                    style={{
                                      height: `${Math.max(height, count > 0 ? 2 : 0)}%`,
                                    }}
                                    title={`スコア ${scoreValue}: ${count}件`}
                                  />
                                  <span className="text-xs font-medium">
                                    {scoreValue}
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 月次推移 */}
        {allSurveysNps.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>月次NPS推移</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allSurveysNps.map((item) => (
                  <div
                    key={item.survey_id}
                    className="flex items-center justify-between py-2 border-b"
                  >
                    <span className="text-sm">{item.year_month}</span>
                    <div className="flex items-center gap-2">
                      {item.nps !== null ? (
                        <>
                          <span className="text-sm font-medium">
                            {item.nps > 0 ? "+" : ""}
                            {item.nps}
                          </span>
                          <Badge
                            variant={
                              item.nps >= 50
                                ? "default"
                                : item.nps >= 0
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {item.nps >= 50
                              ? "優秀"
                              : item.nps >= 0
                                ? "良好"
                                : "要改善"}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          データなし
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 回答一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>回答一覧</CardTitle>
            <CardDescription>
              記名式のため、回答者名と回答内容を表示します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SurveyResponsesPanel
              questions={questions.map((q) => ({
                id: q.id,
                question_text: q.question_text,
                question_type: q.question_type,
                display_order: q.display_order,
              }))}
              responses={responses.map((r) => ({
                id: r.id,
                question_id: r.question_id,
                user_id: r.user_id,
                user_name: (r as { user_name?: string }).user_name ?? "不明",
                created_at: r.created_at,
                score_value: r.score_value,
                text_value: r.text_value,
              }))}
            />
          </CardContent>
        </Card>

        {/* 未回答者一覧 */}
        {unansweredUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>未回答者一覧</CardTitle>
              <CardDescription>
                回答を促すための確認用リストです。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {unansweredUsers.map((user) => (
                  <div key={user.id} className="text-sm">
                    {user.name}
                  </div>
                ))}
              </div>
              <UnansweredSlackReminder kind="enps" surveyId={id} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
