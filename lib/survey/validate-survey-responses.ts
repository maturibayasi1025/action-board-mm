/** サーバーアクションで enps_questions / award_questions の必須と eNPS 親子を検証する */

export type EnpsQuestionForValidation = {
  id: string;
  question_type: "score_0_10" | "text";
  is_required: boolean;
  is_active: boolean;
  parent_question_id: string | null;
};

export type AwardQuestionForValidation = {
  id: string;
  question_type: "text" | "textarea" | "user_select";
  is_required: boolean;
  is_active: boolean;
};

const REQUIRED_MESSAGE = "必須の質問に回答してください";

export function validateEnpsResponses(
  questions: EnpsQuestionForValidation[],
  responses: Array<{
    question_id: string;
    score_value?: number | null;
    text_value?: string | null;
  }>,
): { ok: true } | { ok: false; message: string } {
  const byId = new Map(responses.map((r) => [r.question_id, r]));
  const active = questions.filter((q) => q.is_active);

  for (const q of active) {
    if (!q.is_required) {
      continue;
    }
    const r = byId.get(q.id);
    if (!q.parent_question_id) {
      if (!r) {
        return { ok: false, message: REQUIRED_MESSAGE };
      }
      if (q.question_type === "score_0_10" && r.score_value == null) {
        return { ok: false, message: REQUIRED_MESSAGE };
      }
      if (q.question_type === "text" && !r.text_value?.trim()) {
        return { ok: false, message: REQUIRED_MESSAGE };
      }
    } else {
      const parent = active.find((p) => p.id === q.parent_question_id);
      if (!parent) {
        continue;
      }
      const pr = byId.get(parent.id);
      if (parent.question_type === "score_0_10" && pr?.score_value == null) {
        return { ok: false, message: REQUIRED_MESSAGE };
      }
      if (q.question_type === "text" && !r?.text_value?.trim()) {
        return { ok: false, message: REQUIRED_MESSAGE };
      }
    }
  }

  return { ok: true };
}

export function validateAwardResponses(
  questions: AwardQuestionForValidation[],
  responses: Array<{
    question_id: string;
    text_value?: string | null;
    nominee_user_id?: string | null;
  }>,
): { ok: true } | { ok: false; message: string } {
  const byId = new Map(responses.map((r) => [r.question_id, r]));

  for (const q of questions) {
    if (!q.is_active || !q.is_required) {
      continue;
    }
    const r = byId.get(q.id);
    if (q.question_type === "user_select") {
      if (!r?.nominee_user_id?.trim()) {
        return { ok: false, message: REQUIRED_MESSAGE };
      }
    } else if (!r?.text_value?.trim()) {
      return { ok: false, message: REQUIRED_MESSAGE };
    }
  }

  return { ok: true };
}
