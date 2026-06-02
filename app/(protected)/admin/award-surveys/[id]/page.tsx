import { listGlobalUnansweredExclusions } from "@/app/(protected)/admin/_actions/unanswered-global-exclusions";
import { listAwardLateSubmissionGrants } from "@/app/(protected)/admin/award-surveys/[id]/late-grant-actions";
import { AwardNominationSummary } from "@/components/admin/award-nomination-summary";
import { AwardWinnerCommentSummary } from "@/components/admin/award-winner-comment-summary";
import { LateSubmissionGrantPanel } from "@/components/admin/late-submission-grant-panel";
import { SurveyResponsesPanel } from "@/components/admin/survey-responses-panel";
import { UnansweredExclusionPanel } from "@/components/admin/unanswered-exclusion-panel";
import { UnansweredSlackReminder } from "@/components/admin/unanswered-slack-reminder";
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
  const {
    questions,
    responses,
    nominationDetails,
    lateNominationDetails,
    winnerComments,
  } = await getAwardSurveyResponses(id);
  const unansweredUsers = await getAwardUnansweredUsers(id);
  const excludedGlobalUsers = await listGlobalUnansweredExclusions();
  const awardLateGrants = await listAwardLateSubmissionGrants(id);

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

        {nominationDetails.length > 0 && (
          <AwardNominationSummary
            rows={nominationDetails}
            groupOrder={QUESTION_GROUP_ORDER}
            groupLabels={QUESTION_GROUP_LABELS}
          />
        )}

        {lateNominationDetails.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-muted-foreground">
              期限後回答（承認済み）の指名集計
            </h2>
            <AwardNominationSummary
              rows={lateNominationDetails}
              groupOrder={QUESTION_GROUP_ORDER}
              groupLabels={QUESTION_GROUP_LABELS}
            />
          </div>
        )}

        {winnerComments.length > 0 && (
          <AwardWinnerCommentSummary
            groups={winnerComments}
            surveyTitle={survey.title}
          />
        )}

        <LateSubmissionGrantPanel
          surveyId={id}
          kind="award"
          unansweredCandidates={unansweredUsers}
          existingGrants={awardLateGrants}
        />

        {/* セクション別回答一覧 */}
        {QUESTION_GROUP_ORDER.map((group) => {
          const groupQuestions = questionsByGroup[group] || [];
          if (groupQuestions.length === 0) return null;

          const groupQuestionIds = new Set(groupQuestions.map((q) => q.id));
          const hasAnyInGroup = responses.some((r) =>
            groupQuestionIds.has(r.question_id),
          );
          if (!hasAnyInGroup) return null;

          return (
            <Card key={group}>
              <CardHeader>
                <CardTitle>{QUESTION_GROUP_LABELS[group]}</CardTitle>
              </CardHeader>
              <CardContent>
                <SurveyResponsesPanel
                  questions={groupQuestions.map((q) => ({
                    id: q.id,
                    question_text: q.question_text,
                    question_type: q.question_type,
                    display_order: q.display_order,
                  }))}
                  responses={responses.map((r) => ({
                    id: r.id,
                    question_id: r.question_id,
                    user_id: r.user_id,
                    user_name: r.user_name,
                    company_name: r.company_name,
                    business_unit_name: r.business_unit_name,
                    created_at: r.created_at,
                    score_value: null,
                    text_value: r.text_value,
                    nominee_user_id: r.nominee_user_id,
                    nominee_user_name: r.nominee_user_name,
                    is_late_submission: r.is_late_submission,
                  }))}
                />
              </CardContent>
            </Card>
          );
        })}

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
                <UnansweredSlackReminder kind="award" surveyId={id} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
