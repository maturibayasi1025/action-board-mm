import { Badge } from "@/components/ui/badge";
import type {
  EnpsAiSentiment,
  EnpsAiSummaryRecord,
} from "@/lib/admin/enps-report/ai-summary-types";

const SENTIMENT_LABEL: Record<EnpsAiSentiment, string> = {
  positive: "肯定的",
  negative: "否定的",
  mixed: "賛否あり",
};

const SENTIMENT_CLASS: Record<EnpsAiSentiment, string> = {
  positive: "bg-green-100 text-green-800 hover:bg-green-100",
  negative: "bg-red-100 text-red-800 hover:bg-red-100",
  mixed: "bg-orange-100 text-orange-800 hover:bg-orange-100",
};

function HighlightList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className={`text-sm font-medium ${tone}`}>{title}</h4>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AiAnalysisPanel({
  summary,
  responsesHref,
  emptyScopeLabel = "この会社・この月",
}: {
  summary: EnpsAiSummaryRecord | null;
  responsesHref: string;
  emptyScopeLabel?: string;
}) {
  if (!summary) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {emptyScopeLabel}
          のAI分析はありません。自由記述が5件未満の場合は、個人が特定されうるため生成していません。
        </p>
        <p className="text-sm text-muted-foreground">
          分析は画面表示時ではなく、GitHub Actions の「Build Monthly eNPS
          Report」ワークフロー実行時にだけ生成されます。Repository Secret の
          ENPS_REPORT_AI_API_KEY
          を設定したうえで、対象月を指定して force
          付きでワークフローを再実行してください。Cloudflare / Vercel
          のプレビュー環境変数にキーを設定しても反映されません。
        </p>
      </div>
    );
  }

  const { payload } = summary;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
        <p>
          AIが自由記述 {summary.input_response_count}{" "}
          件を要約したものです。判断の前に
          <a
            href={responsesHref}
            className="mx-1 text-primary underline underline-offset-2 hover:no-underline"
          >
            回答一覧
          </a>
          で原文を確認してください。
        </p>
        <p>
          生成: {new Date(summary.generated_at).toLocaleString("ja-JP")} /
          モデル: {summary.model}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">全体傾向</h3>
        <p className="text-sm leading-relaxed">{payload.overview}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <HighlightList
          title="推奨者が評価している点"
          items={payload.promoter_highlights}
          tone="text-green-700"
        />
        <HighlightList
          title="批判者が問題視している点"
          items={payload.detractor_highlights}
          tone="text-red-700"
        />
      </div>

      {payload.themes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">テーマ別の内訳</h3>
          <div className="space-y-3">
            {payload.themes.map((theme) => (
              <div
                key={theme.name}
                className="rounded-md border border-border p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{theme.name}</span>
                  <Badge
                    variant="secondary"
                    className={SENTIMENT_CLASS[theme.sentiment]}
                  >
                    {SENTIMENT_LABEL[theme.sentiment]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    言及 {theme.mention_count} 件
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{theme.summary}</p>
                {theme.representative_comments.length > 0 && (
                  <ul className="space-y-1.5">
                    {theme.representative_comments.map((comment) => (
                      <li
                        key={comment}
                        className="border-l-2 border-border pl-3 text-sm text-muted-foreground"
                      >
                        {comment}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {payload.action_suggestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">改善アクション案</h3>
          <ol className="space-y-3">
            {payload.action_suggestions.map((action, index) => (
              <li
                key={action.title}
                className="rounded-md border border-border p-3 space-y-1"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="font-medium">{action.title}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {action.rationale}
                </p>
                <p className="text-xs text-muted-foreground">
                  関連テーマ: {action.related_theme}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
