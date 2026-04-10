import type {
  EnpsOrgDrilldownSourceRow,
  EnpsResponseForOrgAggregate,
} from "@/lib/admin/enps-nps-by-business-unit";
import type { PrivateUserOrgRow } from "@/lib/admin/private-user-org";
import { companyAndBusinessUnitFromPrivateUserRow } from "@/lib/admin/private-user-org";

/**
 * `now >= end_date` のとき、当該アンケートは「終了」とみなす。
 */
export function isEnpsSurveyEnded(endDateIso: string, now: Date): boolean {
  return now.getTime() >= new Date(endDateIso).getTime();
}

/**
 * 回答行から、質問IDごとに「スコア行が1件でもある」ユーザーID集合を作る（期限内・遅延の別は問わない）。
 */
export function userIdsWithScoreByQuestionId(
  rows: Array<{
    question_id: string;
    user_id: string;
    score_value: number | null;
  }>,
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.score_value === null || r.user_id == null) continue;
    let set = m.get(r.question_id);
    if (!set) {
      set = new Set();
      m.set(r.question_id, set);
    }
    set.add(r.user_id);
  }
  return m;
}

/**
 * インプット対象: eligible に含まれ、かつ当該質問にスコア行がないユーザー。
 */
export function listImputedUserIdsForQuestion(
  eligibleUserIds: Set<string>,
  userIdsWithAnyScoreForQuestion: Set<string>,
): string[] {
  const out: string[] = [];
  for (const id of Array.from(eligibleUserIds)) {
    if (!userIdsWithAnyScoreForQuestion.has(id)) {
      out.push(id);
    }
  }
  return out;
}

export type PrivateUserForImputation = {
  id: string;
  name: string;
  business_units: PrivateUserOrgRow["business_units"];
};

export function buildPrivateUserOrgMap(
  users: PrivateUserForImputation[],
): Map<
  string,
  { name: string; company_name: string; business_unit_name: string }
> {
  const map = new Map<
    string,
    { name: string; company_name: string; business_unit_name: string }
  >();
  for (const u of users) {
    const { company_name, business_unit_name } =
      companyAndBusinessUnitFromPrivateUserRow(u as PrivateUserOrgRow);
    map.set(u.id, {
      name: u.name,
      company_name,
      business_unit_name,
    });
  }
  return map;
}

const IMPUTED_CREATED_AT = "1970-01-01T00:00:00.000Z";

export function buildImputedOrgAggregateRows(
  questionId: string,
  imputedUserIds: string[],
  userOrgById: Map<
    string,
    { company_name: string; business_unit_name: string }
  >,
): EnpsResponseForOrgAggregate[] {
  const rows: EnpsResponseForOrgAggregate[] = [];
  for (const userId of imputedUserIds) {
    const org = userOrgById.get(userId);
    rows.push({
      question_id: questionId,
      user_id: userId,
      score_value: 0,
      is_late_submission: false,
      created_at: IMPUTED_CREATED_AT,
      company_name: org?.company_name ?? "",
      business_unit_name: org?.business_unit_name ?? "",
    });
  }
  return rows;
}

export function buildImputedDrilldownRows(
  questionId: string,
  imputedUserIds: string[],
  userOrgById: Map<
    string,
    { name: string; company_name: string; business_unit_name: string }
  >,
): EnpsOrgDrilldownSourceRow[] {
  const rows: EnpsOrgDrilldownSourceRow[] = [];
  for (const userId of imputedUserIds) {
    const u = userOrgById.get(userId);
    rows.push({
      question_id: questionId,
      user_id: userId,
      user_name: u?.name ?? "不明",
      score_value: 0,
      company_name: u?.company_name ?? "",
      business_unit_name: u?.business_unit_name ?? "",
      is_late_submission: false,
      created_at: IMPUTED_CREATED_AT,
    });
  }
  return rows;
}

/**
 * 組織フィルタ用: 会社・事業部が一致する eligible ユーザーのみ残す。
 */
export function filterUserIdsByOrg(
  userIds: string[],
  userOrgById: Map<
    string,
    { company_name: string; business_unit_name: string }
  >,
  companyName: string,
  businessUnitName: string,
): string[] {
  const co = companyName.trim();
  const bu = businessUnitName.trim();
  return userIds.filter((id) => {
    const org = userOrgById.get(id);
    if (!org) return false;
    return (
      org.company_name.trim() === co && org.business_unit_name.trim() === bu
    );
  });
}
