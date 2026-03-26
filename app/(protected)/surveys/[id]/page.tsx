import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirectToSignInWithReturnPath } from "@/lib/auth/redirect-to-sign-in";
import { toSerializableAuthUser } from "@/lib/auth/serializable-user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getLinkedPostMissionContext } from "../_lib/linked-post-mission";
import { SurveyFormClient } from "./_components/survey-form-client";
import { getSurvey, getSurveyQuestions, getUserResponses } from "./actions";

export const runtime = "edge";

interface SurveyPageProps {
  params: Promise<{ id: string }>;
}

export default async function SurveyPage({ params }: SurveyPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirectToSignInWithReturnPath(`/surveys/${id}`);
  }

  const survey = await getSurvey(id);
  const questions = await getSurveyQuestions();
  const existingResponses = await getUserResponses(id);

  if (!survey) {
    redirect("/");
  }

  const now = new Date();
  const startDate = new Date(survey.start_date);
  const endDate = new Date(survey.end_date);
  const isExpired = endDate < now;
  const isNotStarted = startDate > now;
  const isSurveyInActiveWindow = !isNotStarted && !isExpired;

  const isFirstTimeResponse = Object.keys(existingResponses).length === 0;
  const linkedPostMission =
    user && isFirstTimeResponse && isSurveyInActiveWindow
      ? await getLinkedPostMissionContext("enps", user.id)
      : null;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{survey.title}</h1>
          {survey.description && (
            <p className="text-muted-foreground">{survey.description}</p>
          )}
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
            <SurveyFormClient
              surveyId={id}
              questions={questions}
              existingResponses={existingResponses}
              linkedPostMission={linkedPostMission}
              isFirstTimeResponse={isFirstTimeResponse}
              authUser={toSerializableAuthUser(user)}
            />
          ))}

        {Object.keys(existingResponses).length > 0 && !isExpired && (
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
