import { CompanyComparisonTable } from "@/components/admin/enps-report/company-comparison-table";
import { ComparisonExportButton } from "@/components/admin/enps-report/report-export-buttons";
import { ReportQueryPicker } from "@/components/admin/enps-report/report-survey-picker";
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
import { getCompanyComparison, listReportSurveys } from "./actions";

export const runtime = "edge";

function EmptyState() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <p className="text-center text-muted-foreground">
          レポート用のスナップショットがまだありません。
        </p>
        <p className="text-center text-sm text-muted-foreground">
          月次バッチ（Build Monthly eNPS
          Report）が実行されると、締切済みのアンケートから自動で作成されます。
        </p>
      </CardContent>
    </Card>
  );
}

export default async function EnpsReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ survey?: string }>;
}) {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const surveys = await listReportSurveys();
  const params = await searchParams;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">eNPS 会社別レポート</h1>
            <p className="text-muted-foreground">
              確定済みの月次スナップショットから、会社を横並びで比較します。会社名を選ぶと個別のレポートを開きます。
            </p>
          </div>
          <Link href="/admin/enps-surveys">
            <Button variant="outline">一覧に戻る</Button>
          </Link>
        </div>

        {surveys.length === 0 ? (
          <EmptyState />
        ) : (
          <ReportComparison
            surveys={surveys}
            selectedSurveyId={
              params.survey &&
              surveys.some((s) => s.survey_id === params.survey)
                ? params.survey
                : surveys[0].survey_id
            }
          />
        )}
      </div>
    </div>
  );
}

async function ReportComparison({
  surveys,
  selectedSurveyId,
}: {
  surveys: Awaited<ReturnType<typeof listReportSurveys>>;
  selectedSurveyId: string;
}) {
  const result = await getCompanyComparison(selectedSurveyId);

  if (!result) {
    return <EmptyState />;
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <ReportQueryPicker
          id="enps-report-survey"
          label="対象月"
          paramName="survey"
          value={selectedSurveyId}
          options={surveys.map((s) => ({
            value: s.survey_id,
            label: `${s.year_month}（${s.title}）`,
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>会社別サマリー / {result.survey.year_month}</CardTitle>
          <CardDescription>
            eNPS は回答者を母数とした値です。前月差は
            {result.previousSurvey
              ? `${result.previousSurvey.year_month} との比較`
              : "比較対象の月がないため空欄"}
            。回答者が5人未満の区分は個人が特定されうるため n&lt;5
            と表示します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <ComparisonExportButton
              yearMonth={result.survey.year_month}
              previousYearMonth={result.previousSurvey?.year_month ?? null}
              questions={result.questions}
              rows={result.rows}
            />
          </div>
          <CompanyComparisonTable
            rows={result.rows}
            questions={result.questions}
            surveyId={result.survey.survey_id}
          />
          <p className="text-xs text-muted-foreground">
            eNPS の色は、グループ全体との差が ±10
            以上のときに強調されます。集計対象は、未回答催促の除外設定がされていない在籍ユーザーです。
          </p>
        </CardContent>
      </Card>
    </>
  );
}
