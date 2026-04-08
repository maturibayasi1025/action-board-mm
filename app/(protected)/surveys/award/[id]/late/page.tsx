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
import { validateAwardLateGrantAccess } from "@/lib/survey/validate-late-grant-service";
import { redirect } from "next/navigation";
import { AwardSurveyFormClient } from "../_components/award-survey-form-client";
import {
  getAwardQuestions,
  getAwardSurvey,
  getCurrentUserName,
  getUserAwardResponses,
} from "../actions";

export const runtime = "edge";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ g?: string; t?: string }>;
}

export default async function AwardSurveyLatePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const grantId = sp.g?.trim();
  const token = sp.t?.trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const q = new URLSearchParams();
    if (grantId) q.set("g", grantId);
    if (token) q.set("t", token);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    redirectToSignInWithReturnPath(`/surveys/award/${id}/late${suffix}`);
  }

  if (!grantId || !token) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>リンクが不正です</CardTitle>
            <CardDescription>
              期限後回答用のURL（g・t パラメータ付き）でアクセスしてください。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const survey = await getAwardSurvey(id);
  const questions = await getAwardQuestions();
  const existingResponses = await getUserAwardResponses(id);
  const userName = await getCurrentUserName();

  if (!survey) {
    redirect("/");
  }

  const accessOk = await validateAwardLateGrantAccess(
    id,
    grantId,
    token,
    user.id,
  );

  if (!accessOk) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>期限後回答を利用できません</CardTitle>
            <CardDescription>
              リンクの有効期限切れ、別アカウントでのログイン、またはすでに回答済みの可能性があります。管理者に再発行を依頼してください。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const hasResponded = Object.keys(existingResponses).length > 0;
  if (hasResponded) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center text-muted-foreground">
            すでにこのアンケートに回答済みです。
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              質問が設定されていません。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <p className="text-sm rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
            管理者承認済みの期限後回答です。提出後は本番集計の「期限内回答」とは別枠になります。
          </p>
        </div>

        <AwardSurveyFormClient
          surveyId={id}
          questions={questions}
          existingResponses={existingResponses}
          userName={userName}
          linkedPostMission={null}
          isFirstTimeResponse
          authUser={toSerializableAuthUser(user)}
          lateGrant={{ grantId, token }}
        />
      </div>
    </div>
  );
}
