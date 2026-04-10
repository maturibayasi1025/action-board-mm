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
  /** 所属会社名（未設定は空文字） */
  company_name: string;
  /** 所属事業部名（未設定は空文字） */
  business_unit_name: string;
  created_at: string;
  score_value: number | null;
  text_value: string | null;
  /** 期限後（管理者承認）提出 */
  is_late_submission?: boolean;
}

/** 管理画面アンケート回答一覧の並び順 */
export type ResponseSortOrder =
  | "name"
  | "company"
  | "business_unit"
  | "score_asc"
  | "score_desc";

export function compareAdminSurveyRows(
  a: AdminSurveyResponseRow,
  b: AdminSurveyResponseRow,
  sortOrder: ResponseSortOrder,
): number {
  const cmpCompany = a.company_name.localeCompare(b.company_name, "ja");
  const cmpBu = a.business_unit_name.localeCompare(b.business_unit_name, "ja");
  const cmpName = a.user_name.localeCompare(b.user_name, "ja");

  switch (sortOrder) {
    case "name":
      if (cmpName !== 0) return cmpName;
      if (cmpCompany !== 0) return cmpCompany;
      return cmpBu;
    case "company":
      if (cmpCompany !== 0) return cmpCompany;
      if (cmpBu !== 0) return cmpBu;
      return cmpName;
    case "business_unit":
      if (cmpBu !== 0) return cmpBu;
      if (cmpCompany !== 0) return cmpCompany;
      return cmpName;
    case "score_asc":
    case "score_desc": {
      const sa = a.score_value ?? -1;
      const sb = b.score_value ?? -1;
      const cmp = sortOrder === "score_asc" ? sa - sb : sb - sa;
      if (cmp !== 0) return cmp;
      if (cmpName !== 0) return cmpName;
      if (cmpCompany !== 0) return cmpCompany;
      return cmpBu;
    }
  }
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
  company_name: string;
  business_unit_name: string;
  /** question_id -> 回答（dedupe済み想定） */
  byQuestionId: Record<string, AdminSurveyResponseRow>;
}

/** dedupe 済み responses を回答者別にまとめる（並び順は呼び出し側で行う） */
export function groupDedupedResponsesByUser(
  deduped: AdminSurveyResponseRow[],
): GroupedRespondent[] {
  const byUser = new Map<
    string,
    {
      userName: string;
      company_name: string;
      business_unit_name: string;
      byQuestionId: Record<string, AdminSurveyResponseRow>;
    }
  >();

  for (const r of deduped) {
    let entry = byUser.get(r.user_id);
    if (!entry) {
      entry = {
        userName: r.user_name,
        company_name: r.company_name,
        business_unit_name: r.business_unit_name,
        byQuestionId: {},
      };
      byUser.set(r.user_id, entry);
    }
    entry.byQuestionId[r.question_id] = r;
  }

  return Array.from(byUser.entries()).map(([userId, data]) => ({
    userId,
    userName: data.userName,
    company_name: data.company_name,
    business_unit_name: data.business_unit_name,
    byQuestionId: data.byQuestionId,
  }));
}

/** 回答者別タブではスコア順は意味が薄いため、氏名・会社・事業部ベースに寄せる */
export function respondentTabSortOrder(
  sortOrder: ResponseSortOrder,
): Exclude<ResponseSortOrder, "score_asc" | "score_desc"> {
  if (sortOrder === "score_asc" || sortOrder === "score_desc") {
    return "name";
  }
  return sortOrder;
}

export function compareGroupedRespondents(
  a: GroupedRespondent,
  b: GroupedRespondent,
  sortOrder: ResponseSortOrder,
): number {
  const effective = respondentTabSortOrder(sortOrder);
  const rowA: AdminSurveyResponseRow = {
    id: "",
    question_id: "",
    user_id: a.userId,
    user_name: a.userName,
    company_name: a.company_name,
    business_unit_name: a.business_unit_name,
    created_at: "",
    score_value: null,
    text_value: null,
  };
  const rowB: AdminSurveyResponseRow = {
    id: "",
    question_id: "",
    user_id: b.userId,
    user_name: b.userName,
    company_name: b.company_name,
    business_unit_name: b.business_unit_name,
    created_at: "",
    score_value: null,
    text_value: null,
  };
  return compareAdminSurveyRows(rowA, rowB, effective);
}
