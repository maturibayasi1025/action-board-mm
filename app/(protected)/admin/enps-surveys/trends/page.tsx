import {
  type BusinessUnitRow,
  type CompanyRow,
  listCompaniesAndUnits,
} from "@/app/(protected)/admin/business-units/actions";
import { EnpsTrendsDashboard } from "@/components/admin/enps-trends-dashboard";
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
  getActiveScoreQuestions,
  getEnpsMonthlyTrendsForQuestion,
} from "./actions";

export const runtime = "edge";

export default async function EnpsTrendsPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const questions = await getActiveScoreQuestions();
  if (questions.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">月次eNPS 時系列</h1>
            <Link href="/admin/enps-surveys">
              <Button variant="outline">一覧に戻る</Button>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                有効なスコア質問がありません。質問管理から追加してください。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const initialQuestionId = questions[0].id;
  const initialSeries =
    await getEnpsMonthlyTrendsForQuestion(initialQuestionId);

  const organizationsResult = await listCompaniesAndUnits();
  let companies: CompanyRow[] = [];
  let units: BusinessUnitRow[] = [];
  let organizationsLoadError: string | null = null;

  if (organizationsResult.success) {
    companies = organizationsResult.companies;
    units = organizationsResult.units;
  } else {
    organizationsLoadError = organizationsResult.error;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">月次eNPS 時系列</h1>
            <p className="text-muted-foreground">
              有効な月次アンケートを列（対象年月）として、スコア質問ごとの推移を表示します。
            </p>
          </div>
          <Link href="/admin/enps-surveys">
            <Button variant="outline">一覧に戻る</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>推移ダッシュボード</CardTitle>
            <CardDescription>
              集計は期限内回答のみで、同一ユーザー・同一月は最新の1件です（詳細画面の事業部別NPSと同じ考え方）。未回答は含みません。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnpsTrendsDashboard
              questions={questions}
              initialQuestionId={initialQuestionId}
              initialSeries={initialSeries}
              companies={companies}
              units={units}
              organizationsLoadError={organizationsLoadError}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
