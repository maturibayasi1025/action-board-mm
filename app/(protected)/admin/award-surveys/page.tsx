import { QuarterSelector } from "@/app/(protected)/admin/award-surveys/_components/quarter-selector";
import { QuarterlyRanking } from "@/app/(protected)/admin/award-surveys/_components/quarterly-ranking";
import {
  getAvailableAwardQuarters,
  getAwardQuarterlyNominationRanking,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-actions";
import type { AwardQuarter } from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
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
import { Suspense } from "react";
import { getAwardSurveys, getTotalUsers } from "./actions";

export const runtime = "edge";

function isValidQuarter(q: number): q is AwardQuarter {
  return q === 1 || q === 2 || q === 3 || q === 4;
}

function resolveSelectedQuarter(
  searchParams: { year?: string; q?: string },
  options: { year: number; quarter: AwardQuarter }[],
): { year: number; quarter: AwardQuarter } | null {
  const yearParam = searchParams.year;
  const qParam = searchParams.q;
  if (yearParam && qParam) {
    const year = Number(yearParam);
    const quarter = Number(qParam);
    if (
      Number.isFinite(year) &&
      isValidQuarter(quarter) &&
      options.some((o) => o.year === year && o.quarter === quarter)
    ) {
      return { year, quarter };
    }
  }
  return options[0] ?? null;
}

type PageProps = {
  searchParams: Promise<{ year?: string; q?: string }>;
};

export default async function AwardSurveysAdminPage({
  searchParams,
}: PageProps) {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const params = await searchParams;
  const [surveys, totalUsers, quarterOptions] = await Promise.all([
    getAwardSurveys(),
    getTotalUsers(),
    getAvailableAwardQuarters(),
  ]);

  const selected = resolveSelectedQuarter(params, quarterOptions);
  const ranking =
    selected != null
      ? await getAwardQuarterlyNominationRanking(
          selected.year,
          selected.quarter,
        )
      : null;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">表彰アンケート管理</h1>
            <p className="text-muted-foreground">
              月次表彰アンケートの作成・管理を行います。
            </p>
          </div>
          <Link href="/admin/award-surveys/questions">
            <Button variant="outline">質問を管理</Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>四半期ランキング（バリュー別トップ5）</CardTitle>
              <CardDescription className="mt-2">
                MVV表彰サイクル（Q1: 4–6月・表彰6月 / Q2: 7–8月・表彰9月 / Q3:
                9–11月・表彰12月 / Q4:
                12–2月・表彰3月）に含まれる月次アンケートの指名を合算し、各バリューごとに票数の多い順に最大5名を表示します。期限内・期限後の回答を含みます。
              </CardDescription>
            </div>
            {quarterOptions.length > 0 && selected != null && (
              <Suspense
                fallback={
                  <div className="h-10 w-full max-w-xs animate-pulse rounded-md bg-muted" />
                }
              >
                <QuarterSelector
                  options={quarterOptions}
                  selectedYear={selected.year}
                  selectedQuarter={selected.quarter}
                />
              </Suspense>
            )}
          </CardHeader>
          <CardContent>
            {ranking != null ? (
              <QuarterlyRanking data={ranking} />
            ) : (
              <p className="text-sm text-muted-foreground">
                月次アンケートが作成されると、四半期ごとのランキングを表示できます。
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>アンケート一覧</CardTitle>
            <CardDescription>全ユーザー数: {totalUsers}人</CardDescription>
          </CardHeader>
          <CardContent>
            {surveys.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                アンケートがまだ作成されていません。
              </p>
            ) : (
              <div className="space-y-4">
                {surveys.map((survey) => {
                  const responseRate =
                    totalUsers > 0
                      ? Math.round(
                          (survey.unique_response_count / totalUsers) * 100,
                        )
                      : 0;

                  return (
                    <Card key={survey.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">
                                {survey.title}
                              </h3>
                              {survey.is_active ? (
                                <Badge variant="default">有効</Badge>
                              ) : (
                                <Badge variant="secondary">無効</Badge>
                              )}
                            </div>
                            {survey.description && (
                              <p className="text-sm text-muted-foreground">
                                {survey.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span>対象年月: {survey.year_month}</span>
                              <span>{survey.period_number}期</span>
                              <span>
                                回答数: {survey.unique_response_count} /{" "}
                                {totalUsers} ({responseRate}%)
                              </span>
                              <span>
                                開始:{" "}
                                {new Date(survey.start_date).toLocaleDateString(
                                  "ja-JP",
                                )}
                              </span>
                              <span>
                                終了:{" "}
                                {new Date(survey.end_date).toLocaleDateString(
                                  "ja-JP",
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/award-surveys/${survey.id}`}>
                              <Button variant="outline" size="sm">
                                集計を見る
                              </Button>
                            </Link>
                            <Link href={`/surveys/award/${survey.id}`}>
                              <Button variant="ghost" size="sm">
                                回答画面
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
