import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirect } from "next/navigation";
import { AwardSurveyFormClient } from "./_components/award-survey-form-client";
import {
  getAwardQuestions,
  getAwardSurvey,
  getCurrentUserName,
  getUserAwardResponses,
} from "./actions";

interface AwardSurveyPageProps {
  params: Promise<{ id: string }>;
}

export default async function AwardSurveyPage({
  params,
}: AwardSurveyPageProps) {
  const { id } = await params;
  const survey = await getAwardSurvey(id);
  const questions = await getAwardQuestions();
  const existingResponses = await getUserAwardResponses(id);
  const userName = await getCurrentUserName();

  if (!survey) {
    redirect("/");
  }

  const now = new Date();
  const startDate = new Date(survey.start_date);
  const endDate = new Date(survey.end_date);
  const isExpired = endDate < now;
  const isNotStarted = startDate > now;
  const hasResponded = Object.keys(existingResponses).length > 0;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{survey.title}</h1>
          {survey.description && (
            <p className="text-muted-foreground whitespace-pre-wrap">
              {survey.description}
            </p>
          )}
          <div className="text-sm text-muted-foreground">
            回答期間: {startDate.toLocaleDateString("ja-JP")} 〜{" "}
            {endDate.toLocaleDateString("ja-JP")}
          </div>
        </div>

        {isNotStarted && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                このアンケートはまだ開始されていません。
                <br />
                開始日時: {startDate.toLocaleString("ja-JP")}
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                このアンケートの回答期限が過ぎています。
                <br />
                終了日時: {endDate.toLocaleString("ja-JP")}
              </p>
            </CardContent>
          </Card>
        )}

        {!isNotStarted &&
          !isExpired &&
          (questions.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  質問が設定されていません。
                </p>
              </CardContent>
            </Card>
          ) : (
            <AwardSurveyFormClient
              surveyId={id}
              questions={questions}
              existingResponses={existingResponses}
              userName={userName}
            />
          ))}

        {hasResponded && !isExpired && (
          <Card>
            <CardHeader>
              <CardTitle>回答済み</CardTitle>
              <CardDescription>
                あなたは既にこのアンケートに回答しています。上記のフォームで回答を更新できます。
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
