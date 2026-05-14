"use client";

import { refreshGoodjobDashboard } from "@/app/(protected)/admin/statistics/actions";
import type {
  GoodjobDatePreset,
  StatisticsDashboardData,
} from "@/app/(protected)/admin/statistics/dashboard-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

const enpsChartConfig = {
  nps: {
    color: "hsl(var(--chart-1))",
    label: "eNPS",
  },
} satisfies ChartConfig;

function formatNps(n: number | null): string {
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n}`;
}

function formatRangeLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleDateString("ja-JP")} 〜 ${end.toLocaleDateString("ja-JP")}`;
}

type StatisticsDashboardProps = {
  initial: StatisticsDashboardData;
};

export function StatisticsDashboard({ initial }: StatisticsDashboardProps) {
  const [goodjobBlock, setGoodjobBlock] = useState(initial.goodjob);
  const [goodjobPreset, setGoodjobPreset] = useState(initial.goodjobPreset);
  const [goodjobRange, setGoodjobRange] = useState(initial.range);
  const [isGoodjobPending, startGoodjobTransition] = useTransition();

  const onGoodjobPresetChange = (value: GoodjobDatePreset) => {
    startGoodjobTransition(async () => {
      const res = await refreshGoodjobDashboard(value);
      setGoodjobPreset(res.preset);
      setGoodjobRange(res.range);
      if (res.success) {
        setGoodjobBlock({ success: true, data: res.data });
      } else {
        setGoodjobBlock({ success: false, error: res.error });
        toast.error(res.error);
      }
    });
  };

  const { enps, award, totalUsers } = initial;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">グッジョブ統計</h2>
            <p className="text-sm text-muted-foreground">
              期間:{" "}
              {formatRangeLabel(goodjobRange.startDate, goodjobRange.endDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="goodjob-period" className="text-xs">
                集計期間
              </Label>
              <Select
                value={goodjobPreset}
                onValueChange={(v) =>
                  onGoodjobPresetChange(v as GoodjobDatePreset)
                }
                disabled={isGoodjobPending}
              >
                <SelectTrigger id="goodjob-period" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last30d">直近30日</SelectItem>
                  <SelectItem value="thisMonth">今月</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-5 sm:pt-0">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/goodjob-matrix">マトリクス</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/assessment-export">査定・CSV</Link>
              </Button>
            </div>
          </div>
        </div>

        {!goodjobBlock.success ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-destructive text-sm">
                {goodjobBlock.error}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  承認済み投稿数
                </CardTitle>
                <CardDescription>期間内のグッジョブ投稿（件）</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {goodjobBlock.data.totalGoodjobPosted}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  投稿した人数: {goodjobBlock.data.usersPosted}人
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  称賛（件）
                </CardTitle>
                <CardDescription>称賛された総件数</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {goodjobBlock.data.totalPraisesReceived}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  1件以上もらった人数: {goodjobBlock.data.usersReceivedPraise}人
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  MVV（件）
                </CardTitle>
                <CardDescription>
                  バリュー別のユニークグッジョブ件数
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">情熱遂行</span>
                  <span className="font-medium tabular-nums">
                    {goodjobBlock.data.totalPassionateExecution}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最高の関係</span>
                  <span className="font-medium tabular-nums">
                    {goodjobBlock.data.totalSupremeRelationships}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">幸福循環</span>
                  <span className="font-medium tabular-nums">
                    {goodjobBlock.data.totalHappinessCirculation}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">いいね</CardTitle>
                <CardDescription>付与数 / 獲得いいね数（件）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">付与</span>
                  <span className="font-medium tabular-nums">
                    {goodjobBlock.data.totalLikesGiven}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">獲得</span>
                  <span className="font-medium tabular-nums">
                    {goodjobBlock.data.totalLikesReceived}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  ミッション達成
                </CardTitle>
                <CardDescription>期間内の達成数（件）</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {goodjobBlock.data.totalMissionAchievements}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">eNPS 統計</h2>
            <p className="text-sm text-muted-foreground">
              有効なスコア質問の先頭（表示順）を対象に月次推移を表示します。集計定義は「月次eNPS
              時系列」画面と同じです。
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/enps-surveys/trends">月次時系列</Link>
          </Button>
        </div>

        {!enps ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground text-sm">
                有効なスコア質問がありません。eNPS
                アンケート管理で質問を有効化してください。
              </p>
              <div className="flex justify-center mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/enps-surveys">eNPS アンケート管理</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">最新月サマリー</CardTitle>
                <CardDescription className="line-clamp-4">
                  {enps.questionText}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {enps.latestPoint ? (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">対象年月</p>
                      <p className="text-lg font-semibold">
                        {enps.latestPoint.year_month} — {enps.latestPoint.title}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">eNPS</p>
                        <p className="text-3xl font-bold tabular-nums">
                          {formatNps(enps.latestPoint.nps)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          回答者数
                        </p>
                        <p className="text-3xl font-bold tabular-nums">
                          {enps.latestPoint.respondent_count}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-md border p-2">
                        <div className="text-muted-foreground">
                          プロモーター
                        </div>
                        <div className="font-semibold tabular-nums">
                          {enps.latestPoint.promoters}
                        </div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-muted-foreground">パッシブ</div>
                        <div className="font-semibold tabular-nums">
                          {enps.latestPoint.passives}
                        </div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-muted-foreground">
                          デトラクター
                        </div>
                        <div className="font-semibold tabular-nums">
                          {enps.latestPoint.detractors}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    データがありません。
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">月次推移</CardTitle>
                <CardDescription>
                  横軸は対象年月（year_month）。N/A
                  はグラフ上では欠損として表示されます。
                </CardDescription>
              </CardHeader>
              <CardContent>
                {enps.series.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    系列データがありません。
                  </p>
                ) : (
                  <ChartContainer
                    config={enpsChartConfig}
                    className="h-[240px] w-full"
                  >
                    <LineChart
                      data={enps.series.map((p) => ({
                        ym: p.year_month,
                        nps: p.nps,
                      }))}
                      margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="ym" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={36} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => [
                              typeof value === "number"
                                ? formatNps(value)
                                : "—",
                              "eNPS",
                            ]}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="nps"
                        stroke="var(--color-nps)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">表彰統計</h2>
            <p className="text-sm text-muted-foreground">
              最新の表彰アンケート（作成日時が新しいもの）の回答・指名サマリーです。
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/award-surveys">一覧・管理</Link>
            </Button>
            {award ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/award-surveys/${award.surveyId}`}>
                  このアンケートの集計
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {!award ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground text-sm">
                表彰アンケートがまだありません。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base">{award.title}</CardTitle>
                <CardDescription>
                  対象年月: {award.yearMonth} — 全ユーザー {totalUsers} 人
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ユニーク回答者</span>
                  <span className="font-medium tabular-nums">
                    {award.uniqueResponders} 人
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">未回答（候補）</span>
                  <span className="font-medium tabular-nums">
                    {award.unansweredCount} 人
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">指名回答総数</span>
                  <span className="font-medium tabular-nums">
                    {award.totalNominations} 件
                  </span>
                </div>
                {totalUsers > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      回答率（目安）
                    </span>
                    <span className="font-medium tabular-nums">
                      {Math.round((award.uniqueResponders / totalUsers) * 100)}%
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  設問別ランキング（全設問・1〜3位の枠）
                </CardTitle>
                <CardDescription>
                  表彰マスタの全設問（短文・長文）を表示順どおり並べ、各設問で期限内回答の同一テキスト
                  を集計しています。並びは件数の多い順です。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {award.nominationRankingsByQuestion.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    集計対象の設問がマスタにありません。
                  </p>
                ) : (
                  award.nominationRankingsByQuestion.map((block) => (
                    <div
                      key={block.questionId}
                      className="space-y-2 border-b pb-6 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <p className="text-sm font-medium leading-snug flex-1 min-w-0">
                          {block.questionText}
                        </p>
                        <div className="flex shrink-0 flex-wrap gap-1">
                          {!block.isActive ? (
                            <Badge variant="secondary" className="text-xs">
                              無効
                            </Badge>
                          ) : null}
                          <Badge
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {block.questionType === "textarea"
                              ? "長文"
                              : "短文"}
                          </Badge>
                        </div>
                      </div>
                      {block.questionGroup ? (
                        <p className="text-xs text-muted-foreground">
                          グループ: {block.questionGroup}
                        </p>
                      ) : null}
                      <ul className="grid gap-2 sm:grid-cols-3">
                        {block.topThree.map((row, i) => (
                          <li
                            key={`${block.questionId}-rank-${i + 1}`}
                            className="flex min-h-[2.75rem] items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                          >
                            {row ? (
                              <>
                                <span
                                  className="min-w-0 truncate sm:line-clamp-2"
                                  title={row.name}
                                >
                                  <span className="tabular-nums text-muted-foreground">
                                    {i + 1}.
                                  </span>{" "}
                                  {row.name}
                                </span>
                                <span className="shrink-0 font-medium tabular-nums">
                                  {row.total}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-muted-foreground">
                                  <span className="tabular-nums">{i + 1}.</span>{" "}
                                  —
                                </span>
                                <span className="shrink-0 text-muted-foreground tabular-nums">
                                  —
                                </span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
                {Object.keys(award.nominationsByGroup).length > 0 ? (
                  <div className="space-y-1 border-t pt-4 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      バリューグループ別（指名件数・全体）
                    </p>
                    {Object.entries(award.nominationsByGroup).map(
                      ([group, count]) => (
                        <div key={group} className="flex justify-between">
                          <span className="text-muted-foreground truncate pr-2">
                            {group}
                          </span>
                          <span className="font-medium tabular-nums shrink-0">
                            {count}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
