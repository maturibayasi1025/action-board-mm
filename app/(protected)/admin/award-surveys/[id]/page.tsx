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
  getAwardSurveyDetail,
  getAwardSurveyResponses,
  getAwardUnansweredUsers,
} from "./actions";

export const runtime = "edge";

const QUESTION_GROUP_LABELS: Record<string, string> = {
  passionate_execution: "夢中になってやり切る",
  supreme_relations: "至高な人間関係を",
  happiness_cycle: "幸せの循環",
  team_value: "チーム/組織のバリュー体現",
};

const QUESTION_GROUP_ORDER = [
  "passionate_execution",
  "supreme_relations",
  "happiness_cycle",
  "team_value",
];

interface AwardSurveyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AwardSurveyDetailPage({
  params,
}: AwardSurveyDetailPageProps) {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const { id } = await params;
  const survey = await getAwardSurveyDetail(id);
  const { questions, responses, nominationSummary } =
    await getAwardSurveyResponses(id);
  const unansweredUsers = await getAwardUnansweredUsers(id);

  if (!survey) {
    redirect("/admin/award-surveys");
  }

  // 回答者数（ユニーク）
  const uniqueResponderCount = new Set(responses.map((r) => r.user_id)).size;

  // グループ別質問整理
  const questionsByGroup = Object.fromEntries(
    QUESTION_GROUP_ORDER.map((group) => [
      group,
      questions.filter((q) => q.question_group === group),
    ]),
  );

  // 指名集計をソート（得票数降順）
  const sortedNominations = Object.entries(nominationSummary).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{survey.title}</h1>
            <p className="text-muted-foreground">
              対象年月: {survey.year_month} | 回答数: {uniqueResponderCount}人
            </p>
          </div>
          <Link href="/admin/award-surveys">
            <Button variant="outline">一覧に戻る</Button>
          </Link>
        </div>

        {/* 指名集計 */}
        {sortedNominations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>他者指名 集計</CardTitle>
              <CardDescription>
                各バリューで指名された人数の合計（重複あり）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedNominations.map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between py-2 border-b"
                  >
                    <span className="font-medium">{name}</span>
                    <Badge variant="secondary">{count}票</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* セクション別回答一覧 */}
        {QUESTION_GROUP_ORDER.map((group) => {
          const groupQuestions = questionsByGroup[group] || [];
          if (groupQuestions.length === 0) return null;

          return (
            <Card key={group}>
              <CardHeader>
                <CardTitle>{QUESTION_GROUP_LABELS[group]}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {groupQuestions
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((question) => {
                      const questionResponses = responses.filter(
                        (r) => r.question_id === question.id,
                      );
                      if (questionResponses.length === 0) return null;

                      return (
                        <div key={question.id} className="space-y-2">
                          <h3 className="font-semibold text-sm">
                            {question.question_text}
                          </h3>
                          <div className="space-y-2">
                            {questionResponses.map((response) => (
                              <div
                                key={response.id}
                                className="p-3 border rounded-lg space-y-1"
                              >
                                <div className="text-sm font-medium">
                                  {response.user_name}
                                </div>
                                {response.text_value && (
                                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {response.text_value}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  {new Date(response.created_at).toLocaleString(
                                    "ja-JP",
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          );
        })}

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
              <UnansweredSlackReminder kind="award" surveyId={id} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
