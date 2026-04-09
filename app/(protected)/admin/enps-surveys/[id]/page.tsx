import { listGlobalUnansweredExclusions } from "@/app/(protected)/admin/_actions/unanswered-global-exclusions";
import { listEnpsLateSubmissionGrants } from "@/app/(protected)/admin/enps-surveys/[id]/late-grant-actions";
import { EnpsSurveyQuestionAnalytics } from "@/components/admin/enps-survey-question-analytics";
import { LateSubmissionGrantPanel } from "@/components/admin/late-submission-grant-panel";
import { SurveyResponsesPanel } from "@/components/admin/survey-responses-panel";
import { UnansweredExclusionPanel } from "@/components/admin/unanswered-exclusion-panel";
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
import type { EnpsOrgDrilldownSourceRow } from "@/lib/admin/enps-nps-by-business-unit";
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
  const {
    questions,
    responses,
    npsData,
    lateNpsData,
    uniqueRespondentCount,
    npsByBusinessUnitOnTime,
    npsByBusinessUnitLate,
  } = await getSurveyResponses(id);
  const unansweredUsers = await getUnansweredUsers(id);
  const excludedGlobalUsers = await listGlobalUnansweredExclusions();
  const allSurveysNps = await getAllSurveysNps();
  const enpsLateGrants = await listEnpsLateSubmissionGrants(id);

  if (!survey) {
    redirect("/admin/enps-surveys");
  }

  const scoreQuestions = questions.filter(
    (q) => q.question_type === "score_0_10",
  );

  const scoreQuestionIdSet = new Set(scoreQuestions.map((q) => q.id));
  const orgDrilldownRows: EnpsOrgDrilldownSourceRow[] = responses
    .filter(
      (r) => r.score_value !== null && scoreQuestionIdSet.has(r.question_id),
    )
    .map((r) => ({
      question_id: r.question_id,
      user_id: r.user_id,
      user_name: (r as { user_name?: string }).user_name ?? "不明",
      score_value: r.score_value as number,
      company_name: (r as { company_name?: string }).company_name ?? "",
      business_unit_name:
        (r as { business_unit_name?: string }).business_unit_name ?? "",
      is_late_submission: r.is_late_submission,
      created_at: r.created_at,
    }));

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{survey.title}</h1>
            <p className="text-muted-foreground">
              対象年月: {survey.year_month} | 回答者数: {uniqueRespondentCount}
              人
            </p>
          </div>
          <Link href="/admin/enps-surveys">
            <Button variant="outline">一覧に戻る</Button>
          </Link>
        </div>

        {scoreQuestions.length > 0 && (
          <EnpsSurveyQuestionAnalytics
            scoreQuestions={scoreQuestions.map((q) => ({
              id: q.id,
              question_text: q.question_text,
            }))}
            npsData={npsData}
            lateNpsData={lateNpsData}
            npsByBusinessUnitOnTime={npsByBusinessUnitOnTime}
            npsByBusinessUnitLate={npsByBusinessUnitLate}
            drilldownSourceRows={orgDrilldownRows}
          />
        )}

        <LateSubmissionGrantPanel
          surveyId={id}
          kind="enps"
          unansweredCandidates={unansweredUsers}
          existingGrants={enpsLateGrants}
        />

        {/* 月次eNPS推移 */}
        {allSurveysNps.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>月次eNPS推移</CardTitle>
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
              questionScope="single"
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
                company_name:
                  (r as { company_name?: string }).company_name ?? "",
                business_unit_name:
                  (r as { business_unit_name?: string }).business_unit_name ??
                  "",
                created_at: r.created_at,
                score_value: r.score_value,
                text_value: r.text_value,
                is_late_submission: (r as { is_late_submission?: boolean })
                  .is_late_submission,
              }))}
            />
          </CardContent>
        </Card>

        {/* 未回答者一覧 */}
        {(unansweredUsers.length > 0 || excludedGlobalUsers.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>未回答者一覧</CardTitle>
              <CardDescription>
                {unansweredUsers.length > 0
                  ? "回答を促すための確認用リストです。「対象外」は全アンケート共通で未回答一覧と Slack 通知から外します。"
                  : "現在の未回答者はいません。催促対象外（共通）の設定のみ表示しています。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <UnansweredExclusionPanel
                unansweredUsers={unansweredUsers}
                excludedGlobalUsers={excludedGlobalUsers}
              />
              {unansweredUsers.length > 0 && (
                <UnansweredSlackReminder kind="enps" surveyId={id} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
