/**
 * AI 分析結果の型。画面側はここだけを参照し、生成処理（バッチ専用）には依存しない。
 */

export type EnpsAiSentiment = "positive" | "negative" | "mixed";

export type EnpsAiTheme = {
  name: string;
  mention_count: number;
  sentiment: EnpsAiSentiment;
  summary: string;
  representative_comments: string[];
};

export type EnpsAiActionSuggestion = {
  title: string;
  rationale: string;
  related_theme: string;
};

export type EnpsAiSummaryPayload = {
  overview: string;
  promoter_highlights: string[];
  detractor_highlights: string[];
  themes: EnpsAiTheme[];
  action_suggestions: EnpsAiActionSuggestion[];
};

export type EnpsAiSummaryRecord = {
  company_name: string;
  model: string;
  input_response_count: number;
  generated_at: string;
  payload: EnpsAiSummaryPayload;
};

/** これ未満の自由記述しか無い会社は、個人が特定されうるため生成しない */
export const MIN_AI_SUMMARY_INPUTS = 5;

export function shouldGenerateAiSummary(inputCount: number): boolean {
  return inputCount >= MIN_AI_SUMMARY_INPUTS;
}
