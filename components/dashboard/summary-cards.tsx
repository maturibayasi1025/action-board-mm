import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SummaryCardsProps {
  previousPeriodLikes: number;
  previousPeriodMissions: number;
  totalLikes: number;
  totalMissions: number;
}

function formatDelta(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return { className: "text-muted-foreground", text: "±0.0%" };
    }
    return { className: "text-teal-600", text: "新規" };
  }

  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  const className =
    change > 0
      ? "text-teal-600"
      : change < 0
        ? "text-rose-600"
        : "text-muted-foreground";

  return {
    className,
    text: `${sign}${change.toFixed(1)}%`,
  };
}

export function SummaryCards({
  previousPeriodLikes,
  previousPeriodMissions,
  totalLikes,
  totalMissions,
}: SummaryCardsProps) {
  const missionDelta = formatDelta(totalMissions, previousPeriodMissions);
  const likesDelta = formatDelta(totalLikes, previousPeriodLikes);

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>投稿数（期間合計）</CardDescription>
          <CardTitle>{totalMissions.toLocaleString()} 件</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          前期: {previousPeriodMissions.toLocaleString()} 件
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>いいね数（期間合計）</CardDescription>
          <CardTitle>{totalLikes.toLocaleString()} 件</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          前期: {previousPeriodLikes.toLocaleString()} 件
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>前期比</CardDescription>
          <CardTitle>推移比較</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            投稿数:{" "}
            <span className={missionDelta.className}>{missionDelta.text}</span>
          </p>
          <p>
            いいね数:{" "}
            <span className={likesDelta.className}>{likesDelta.text}</span>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
