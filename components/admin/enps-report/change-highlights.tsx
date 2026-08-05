import type { BusinessUnitChange } from "@/lib/admin/enps-report/comparison";
import { formatDelta, formatNps } from "@/lib/admin/enps-report/format";
import { TrendingDown, TrendingUp } from "lucide-react";

function ChangeList({
  title,
  items,
  tone,
  icon,
  emptyText,
}: {
  title: string;
  items: BusinessUnitChange[];
  tone: string;
  icon: React.ReactNode;
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <span className={tone}>{icon}</span>
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.business_unit_name}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="truncate">{item.business_unit_name}</span>
              <span className="shrink-0 tabular-nums">
                <span className={`font-semibold ${tone}`}>
                  {formatDelta(item.delta)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  （{formatNps(item.current_nps)} / 回答{item.respondent_count}
                  人）
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChangeHighlights({
  improved,
  declined,
  hasPreviousMonth,
  segmentLabel = "事業部",
}: {
  improved: BusinessUnitChange[];
  declined: BusinessUnitChange[];
  hasPreviousMonth: boolean;
  segmentLabel?: string;
}) {
  if (!hasPreviousMonth) {
    return (
      <p className="text-sm text-muted-foreground">
        比較できる前月のスナップショットがないため、変化は表示できません。
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <ChangeList
        title={`改善した${segmentLabel}`}
        items={improved}
        tone="text-green-700"
        icon={<TrendingUp className="h-4 w-4" />}
        emptyText={`前月から改善した${segmentLabel}はありません。`}
      />
      <ChangeList
        title={`悪化した${segmentLabel}`}
        items={declined}
        tone="text-red-700"
        icon={<TrendingDown className="h-4 w-4" />}
        emptyText={`前月から悪化した${segmentLabel}はありません。`}
      />
    </div>
  );
}
