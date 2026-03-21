import { getLinkedPostMissionContext } from "@/app/(protected)/surveys/_lib/linked-post-mission";
import { userRespondedActiveAwardSurvey } from "@/app/(protected)/surveys/_lib/user-responded-active-award-survey";
import { userRespondedActiveEnpsSurvey } from "@/app/(protected)/surveys/_lib/user-responded-active-enps-survey";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateMissionForm } from "@/components/user-mission/create-mission-form";
import { SurveyLinkedGoodjobCta } from "@/components/user-mission/survey-linked-goodjob-cta";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const runtime = "edge";

export default async function NewUserMissionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/sign-in?message=${encodeURIComponent("グッジョブ作成にはログインが必要です")}`,
    );
  }

  const respondedActiveEnps = await userRespondedActiveEnpsSurvey(user.id);
  const respondedActiveAward = await userRespondedActiveAwardSurvey(user.id);
  const linkedEnpsMission = await getLinkedPostMissionContext("enps", user.id);
  const linkedAwardMission = await getLinkedPostMissionContext(
    "award",
    user.id,
  );
  const showEnpsGoodjobCta = respondedActiveEnps && linkedEnpsMission !== null;
  const showAwardGoodjobCta =
    respondedActiveAward && linkedAwardMission !== null;

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      {showEnpsGoodjobCta && linkedEnpsMission && (
        <SurveyLinkedGoodjobCta
          title="eNPSアンケート"
          description="現在受付中の eNPS アンケートへのご回答ありがとうございます。関連グッジョブの達成をここからも記録できます。"
          linkedPostMission={linkedEnpsMission}
          authUser={user}
        />
      )}
      {showAwardGoodjobCta && linkedAwardMission && (
        <SurveyLinkedGoodjobCta
          title="表彰アンケート"
          description="表彰アンケートへのご回答ありがとうございます。関連グッジョブの達成をここからも記録できます。"
          linkedPostMission={linkedAwardMission}
          authUser={user}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>新しいグッジョブを作成</CardTitle>
          <CardDescription>
            素晴らしい行動や成果を賞賛するグッジョブを作成しましょう。
            作成されたグッジョブはすぐにユーザーグッジョブ一覧に公開されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateMissionForm />
        </CardContent>
      </Card>
    </div>
  );
}
