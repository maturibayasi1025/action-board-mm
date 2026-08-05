/**
 * 自由記述のテーマ分類・要約・改善アクション案の生成。
 *
 * 個人の特定を避けるため、モデルに渡すのはスコアとテキストのみで、氏名やユーザーIDは含めない。
 * 自由記述が少ない会社は生成自体を行わない。
 *
 * OpenAI 互換の Chat Completions エンドポイントを fetch で呼ぶ。プロバイダは
 * ENPS_REPORT_AI_BASE_URL で差し替えられるようにしてある。
 */

import {
  type EnpsAiSummaryPayload,
  shouldGenerateAiSummary,
} from "@/lib/admin/enps-report/ai-summary-types";
import { UNASSIGNED_ORG_LABEL } from "@/lib/admin/enps-report/build-snapshot";
import {
  type NpsSegment,
  dedupeLatestByUser,
  scoreToSegment,
} from "@/lib/admin/enps-report/nps";
import { z } from "zod";

export const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_AI_MODEL = "gpt-4o-mini";

/** 1 件あたりの文字数上限。長文がプロンプトを占有するのを防ぐ */
export const MAX_TEXT_LENGTH = 600;
/** 1 リクエストに含める自由記述の上限 */
export const MAX_INPUTS_PER_REQUEST = 400;

export type FreeTextInput = {
  /** 紐づくスコア質問の点数。親質問が無い設問では null */
  score: number | null;
  segment: NpsSegment | null;
  question_text: string;
  text: string;
};

export type TextResponseForAi = {
  question_id: string;
  user_id: string;
  text_value: string | null;
};

export type ScoreResponseForAi = {
  question_id: string;
  user_id: string;
  score_value: number | null;
  is_late_submission?: boolean | null;
  created_at?: string;
};

export type QuestionForAi = {
  id: string;
  question_text: string;
  question_type: string;
  parent_question_id: string | null;
};

export type UserCompany = {
  user_id: string;
  company_name: string;
};

function truncate(text: string, max: number = MAX_TEXT_LENGTH): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/**
 * 自由記述を会社ごとにまとめる。
 * テキスト設問が親（スコア設問）を持つ場合は、同じ回答者のその点数を添えて
 * 「推奨者が何を評価し、批判者が何に不満か」を対比できるようにする。
 */
export function buildAiSummaryInputsByCompany(params: {
  questions: QuestionForAi[];
  textResponses: TextResponseForAi[];
  scoreResponses: ScoreResponseForAi[];
  userCompanies: UserCompany[];
}): Map<string, FreeTextInput[]> {
  const { questions, textResponses, scoreResponses, userCompanies } = params;

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const companyByUser = new Map(
    userCompanies.map((u) => [
      u.user_id,
      u.company_name.trim() || UNASSIGNED_ORG_LABEL,
    ]),
  );

  const onTimeScores = scoreResponses.filter(
    (r) => r.score_value !== null && !r.is_late_submission,
  );

  const dedupedByQuestion = new Map<
    string,
    Map<string, { user_id: string; score_value: number; created_at: string }>
  >();
  for (const r of onTimeScores) {
    let byUser = dedupedByQuestion.get(r.question_id);
    if (!byUser) {
      byUser = new Map();
      dedupedByQuestion.set(r.question_id, byUser);
    }
    byUser.set(r.user_id, {
      user_id: r.user_id,
      score_value: r.score_value as number,
      created_at: r.created_at ?? new Date().toISOString(),
    });
  }

  const scoreByUserQuestion = new Map<string, number>();
  for (const [questionId, byUser] of dedupedByQuestion.entries()) {
    const dedupedForQuestion = dedupeLatestByUser(Array.from(byUser.values()));
    for (const r of dedupedForQuestion) {
      scoreByUserQuestion.set(`${r.user_id}\u0000${questionId}`, r.score_value);
    }
  }

  const byCompany = new Map<string, FreeTextInput[]>();

  for (const response of textResponses) {
    const text = response.text_value?.trim();
    if (!text) continue;

    const company = companyByUser.get(response.user_id);
    if (!company) continue;

    const question = questionById.get(response.question_id);
    if (!question || question.question_type !== "text") continue;

    let score: number | null = null;
    if (question.parent_question_id) {
      const parentScore = scoreByUserQuestion.get(
        `${response.user_id}\u0000${question.parent_question_id}`,
      );
      score = parentScore ?? null;
    }

    const list = byCompany.get(company) ?? [];
    list.push({
      score,
      segment: score === null ? null : scoreToSegment(score),
      question_text: question.question_text,
      text: truncate(text),
    });
    byCompany.set(company, list);
  }

  return byCompany;
}

const SEGMENT_LABEL: Record<NpsSegment, string> = {
  promoter: "推奨者",
  passive: "中立者",
  detractor: "批判者",
};

export function buildAiSummaryPrompt(params: {
  companyName: string;
  yearMonth: string;
  inputs: FreeTextInput[];
}): { system: string; user: string } {
  const { companyName, yearMonth, inputs } = params;
  const limited = inputs.slice(0, MAX_INPUTS_PER_REQUEST);

  const system = [
    "あなたは組織開発の専門家です。従業員エンゲージメント調査（eNPS）の自由記述を分析します。",
    "回答は日本語で、指定された JSON スキーマに厳密に従って出力してください。",
    "推測で断定せず、記述に現れた内容だけを根拠にしてください。",
    "個人を特定できる表現（氏名、役職と部署の組み合わせなど）は要約に含めないでください。",
    "代表コメントは原文をそのまま引用し、要約や言い換えをしないでください。",
  ].join("\n");

  const lines = limited.map((input, index) => {
    const segment =
      input.segment === null
        ? "スコア不明"
        : `${SEGMENT_LABEL[input.segment]}・${input.score}点`;
    return `${index + 1}. [${segment}] (設問: ${input.question_text}) ${input.text}`;
  });

  const user = [
    `対象: ${companyName} / ${yearMonth}`,
    `自由記述 ${limited.length} 件を分析してください。`,
    "",
    "出力する JSON の形式:",
    "{",
    '  "overview": "全体傾向の要約（200文字程度）",',
    '  "promoter_highlights": ["推奨者が評価している点", ...],',
    '  "detractor_highlights": ["批判者が問題視している点", ...],',
    '  "themes": [{"name": "テーマ名", "mention_count": 件数, "sentiment": "positive|negative|mixed", "summary": "テーマの要約", "representative_comments": ["原文引用", ...]}],',
    '  "action_suggestions": [{"title": "改善アクション案", "rationale": "根拠となった記述の傾向", "related_theme": "対応するテーマ名"}]',
    "}",
    "",
    "テーマは「評価・処遇」「人間関係・マネジメント」「業務量・働き方」「成長機会」「経営方針への納得感」などの観点で、",
    "記述の実態に合わせて 3〜6 個に整理してください。改善アクション案は 3〜5 個、実行可能な粒度で提案してください。",
    "",
    "--- 自由記述 ---",
    ...lines,
  ].join("\n");

  return { system, user };
}

const themeSchema = z.object({
  name: z.string(),
  mention_count: z.number().int().nonnegative(),
  sentiment: z.enum(["positive", "negative", "mixed"]),
  summary: z.string(),
  representative_comments: z.array(z.string()),
});

const payloadSchema = z.object({
  overview: z.string(),
  promoter_highlights: z.array(z.string()),
  detractor_highlights: z.array(z.string()),
  themes: z.array(themeSchema),
  action_suggestions: z.array(
    z.object({
      title: z.string(),
      rationale: z.string(),
      related_theme: z.string(),
    }),
  ),
});

export function parseAiSummaryPayload(
  raw: unknown,
): EnpsAiSummaryPayload | null {
  const result = payloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export type AiSummaryConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  /** null のときはリクエストに含めず、モデルの既定値に任せる */
  temperature: number | null;
};

/**
 * temperature は既定で送らない。GPT-5 系や o 系の推論モデルは既定値以外を受け付けず、
 * 指定すると 400 になるため、モデルを差し替えても動くことを優先している。
 * 出力を安定させたい場合のみ ENPS_REPORT_AI_TEMPERATURE で明示する。
 */
export function resolveAiSummaryConfig(
  env: Record<string, string | undefined> = process.env,
): AiSummaryConfig | null {
  const apiKey = env.ENPS_REPORT_AI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const rawTemperature = env.ENPS_REPORT_AI_TEMPERATURE?.trim();
  const parsedTemperature =
    rawTemperature === undefined || rawTemperature === ""
      ? Number.NaN
      : Number(rawTemperature);

  return {
    apiKey,
    model: env.ENPS_REPORT_AI_MODEL?.trim() || DEFAULT_AI_MODEL,
    baseUrl: (
      env.ENPS_REPORT_AI_BASE_URL?.trim() || DEFAULT_AI_BASE_URL
    ).replace(/\/+$/, ""),
    temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : null,
  };
}

export function buildChatCompletionsBody(params: {
  config: AiSummaryConfig;
  system: string;
  user: string;
}): Record<string, unknown> {
  const { config, system, user } = params;

  const body: Record<string, unknown> = {
    model: config.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  if (config.temperature !== null) {
    body.temperature = config.temperature;
  }

  return body;
}

export async function generateEnpsAiSummary(params: {
  config: AiSummaryConfig;
  companyName: string;
  yearMonth: string;
  inputs: FreeTextInput[];
}): Promise<EnpsAiSummaryPayload | null> {
  const { config, companyName, yearMonth, inputs } = params;

  if (!shouldGenerateAiSummary(inputs.length)) {
    return null;
  }

  const { system, user } = buildAiSummaryPrompt({
    companyName,
    yearMonth,
    inputs,
  });

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(buildChatCompletionsBody({ config, system, user })),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `AI分析の呼び出しに失敗しました: ${response.status} ${body}`,
    );
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  try {
    return parseAiSummaryPayload(JSON.parse(content));
  } catch {
    return null;
  }
}
