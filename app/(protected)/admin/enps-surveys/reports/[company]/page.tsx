import { AiAnalysisPanel } from "@/components/admin/enps-report/ai-analysis-panel";
import { BusinessUnitHeatmap } from "@/components/admin/enps-report/business-unit-heatmap";
import { ChangeHighlights } from "@/components/admin/enps-report/change-highlights";
import { CompanyReportSummary } from "@/components/admin/enps-report/company-report-summary";
import {
  CompanyTrendChart,
  SegmentCompositionChart,
} from "@/components/admin/enps-report/company-trend-chart";
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
import { notFound, redirect } from "next/navigation";
import { getCompanyReport, listReportSurveys } from "../actions";

export const runtime = "edge";

export default async function CompanyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ survey?: string; question?: string }>;
}) {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const { company } = await params;
  const { survey: surveyParam, question: questionParam } = await searchParams;
  const companyName = decodeURIComponent(company);

  const surveys = await listReportSurveys();
  if (surveys.length === 0) {
    notFound();
  }

  const surveyId =
    surveyParam && surveys.some((s) => s.survey_id === surveyParam)
      ? surveyParam
      : surveys[0].survey_id;

  const report = await getCompanyReport(surveyId, companyName, questionParam);
  if (!report) {
    notFound();
  }

  const activeMetric = report.comparisonRow?.metrics[report.activeQuestionId];
  const activeQuestion = report.questions.find(
    (q) => q.id === report.activeQuestionId,
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4 print:block">
          <div>
            <p className="text-sm text-muted-foreground">
              eNPS 会社別レポート / {report.survey.year_month}
            </p>
            <h1 className="text-3xl font-bold">{report.companyName}</h1>
          </div>
          <div className="flex gap-2 print:hidden">
            <Link href={`/admin/enps-surveys/reports?survey=${surveyId}`}>
              <Button variant="outline">会社一覧へ</Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end print:hidden">
          <ReportQueryPicker
            id="company-report-survey"
            label="対象月"
            paramName="survey"
            value={surveyId}
            options={surveys.map((s) => ({
              value: s.survey_id,
              label: `${s.year_month}（${s.title}）`,
            }))}
          />
          <ReportQueryPicker
            id="company-report-question"
            label="スコア質問"
            paramName="question"
            value={report.activeQuestionId}
            options={report.questions.map((q) => ({
              value: q.id,
              label: q.question_text,
            }))}
            className="space-y-2 min-w-[12rem] flex-1 sm:max-w-xl"
          />
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            サマリー
            {activeQuestion && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {activeQuestion.question_text}
              </span>
            )}
          </h2>
          <CompanyReportSummary
            metric={activeMetric}
            previousYearMonth={report.previousSurvey?.year_month ?? null}
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>推移</CardTitle>
            <CardDescription>
              直近{report.trend.length}
              ヶ月。回答者ベースと未回答0点補完の開きは、回答率の低さによるものです。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <CompanyTrendChart trend={report.trend} />
            <div className="space-y-2">
              <h3 className="text-sm font-medium">セグメント構成（人数）</h3>
              <SegmentCompositionChart trend={report.trend} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>事業部別</CardTitle>
            <CardDescription>
              eNPS の高い順に並べています（回答者ベース）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessUnitHeatmap rows={report.businessUnits} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>前月からの変化</CardTitle>
            <CardDescription>
              回答者5人未満の事業部は、個人が推測されうるため対象外です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangeHighlights
              improved={report.highlights.improved}
              declined={report.highlights.declined}
              hasPreviousMonth={report.previousSurvey !== null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>自由記述の分析</CardTitle>
            <CardDescription>
              テーマ分類と改善アクション案はAIによる生成です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiAnalysisPanel
              summary={report.aiSummary}
              responsesHref={`/admin/enps-surveys/${report.survey.survey_id}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
