/**
 * 管理画面アンケート回答の集約。
 * DBに (survey_id, user_id, question_id) ユニークがないため、
 * 同一キーが複数ある場合は created_at が最も新しい行のみを代表とする。
 */

export interface AdminSurveyResponseRow {
  id: string;
  question_id: string;
  user_id: string;
  user_name: string;
  created_at: string;
  score_value: number | null;
  text_value: string | null;
}

function isNewer(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

/** user_id + question_id ごとに最新1件だけ残す */
export function dedupeSurveyResponsesLatestPerQuestion(
  responses: AdminSurveyResponseRow[],
): AdminSurveyResponseRow[] {
  const byKey = new Map<string, AdminSurveyResponseRow>();
  for (const r of responses) {
    const key = `${r.user_id}:${r.question_id}`;
    const prev = byKey.get(key);
    if (!prev || isNewer(r.created_at, prev.created_at)) {
      byKey.set(key, r);
    }
  }
  return Array.from(byKey.values());
}

export interface GroupedRespondent {
  userId: string;
  userName: string;
  /** question_id -> 回答（dedupe済み想定） */
  byQuestionId: Record<string, AdminSurveyResponseRow>;
}

/** dedupe 済み responses を回答者別にまとめ、氏名でソート */
export function groupDedupedResponsesByUser(
  deduped: AdminSurveyResponseRow[],
): GroupedRespondent[] {
  const byUser = new Map<
    string,
    { userName: string; byQuestionId: Record<string, AdminSurveyResponseRow> }
  >();

  for (const r of deduped) {
    let entry = byUser.get(r.user_id);
    if (!entry) {
      entry = { userName: r.user_name, byQuestionId: {} };
      byUser.set(r.user_id, entry);
    }
    entry.byQuestionId[r.question_id] = r;
  }

  return Array.from(byUser.entries())
    .map(([userId, data]) => ({
      userId,
      userName: data.userName,
      byQuestionId: data.byQuestionId,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName, "ja"));
}
