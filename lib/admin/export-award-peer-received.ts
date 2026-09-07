import {
  AWARD_QUESTION_GROUP_LABELS,
  AWARD_QUESTION_GROUP_ORDER,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import { buildCsvContent } from "@/lib/admin/export-award-self-eval";
import {
  type AwardNominationQuestion,
  buildNormalizedNameIndex,
  pickNominationQuestionForGroup,
  pickReasonQuestionForNomination,
  resolveNominee,
} from "@/lib/award/nomination-ranking";

export const NOMINATION_GROUP_ORDER = AWARD_QUESTION_GROUP_ORDER;

export type NominationGroupKey = (typeof AWARD_QUESTION_GROUP_ORDER)[number];

export type PeerMasterQuestion = AwardNominationQuestion;

export type PeerResponseRow = {
  survey_id: string;
  user_id: string;
  question_id: string;
  text_value: string | null;
  nominee_user_id: string | null;
  is_late_submission: boolean | null;
};

export type PeerSurveyRow = {
  id: string;
  year_month: string;
  title: string;
};

export type PeerUserRow = {
  id: string;
  name: string;
  companyName: string;
  businessUnitName: string;
  suspended: boolean;
};

export type PeerNominationEvent = {
  surveyId: string;
  yearMonth: string;
  group: NominationGroupKey;
  nomineeKey: string;
  nomineeName: string;
  nomineeUserId: string | null;
  recommenderUserId: string;
  recommenderName: string;
  comment: string;
  isLate: boolean;
};

export type PeerReceivedRow = {
  nomineeKey: string;
  nomineeUserId: string | null;
  name: string;
  companyName: string;
  businessUnitName: string;
  totalVotes: number;
  votesByGroup: Record<NominationGroupKey, number>;
  commentsByGroup: Record<NominationGroupKey, string>;
};

export type PeerReceivedDetailRow = {
  yearMonth: string;
  group: NominationGroupKey;
  groupLabel: string;
  nomineeName: string;
  recommenderName: string;
  comment: string;
  isLate: boolean;
};

export function emptyVotesByGroup(): Record<NominationGroupKey, number> {
  return {
    passionate_execution: 0,
    supreme_relations: 0,
    happiness_cycle: 0,
    team_value: 0,
  };
}

export function emptyCommentsByGroup(): Record<NominationGroupKey, string> {
  return {
    passionate_execution: "",
    supreme_relations: "",
    happiness_cycle: "",
    team_value: "",
  };
}

export function isNominationGroupKey(
  value: string | null,
): value is NominationGroupKey {
  return (
    value === "passionate_execution" ||
    value === "supreme_relations" ||
    value === "happiness_cycle" ||
    value === "team_value"
  );
}

export function voteColumnLabel(group: NominationGroupKey): string {
  switch (group) {
    case "passionate_execution":
      return "夢中票";
    case "supreme_relations":
      return "至高票";
    case "happiness_cycle":
      return "幸せ票";
    case "team_value":
      return "チーム票";
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

export function receivedCommentColumnLabel(group: NominationGroupKey): string {
  const base = AWARD_QUESTION_GROUP_LABELS[group] ?? group;
  return `${base}（受けた推薦）`;
}

export function pickReasonQuestionForGroup(
  questions: PeerMasterQuestion[],
  nominationQuestion: PeerMasterQuestion,
): PeerMasterQuestion | undefined {
  return pickReasonQuestionForNomination(questions, nominationQuestion);
}

export type PeerNomineeLookup = {
  users: Map<string, PeerUserRow>;
  userNameById: Map<string, string>;
  nameIndex: Map<string, string[]>;
  suspendedIds: Set<string>;
};

export function peerNomineeLookupFromUsers(
  users: Map<string, PeerUserRow>,
): PeerNomineeLookup {
  const suspendedIds = new Set<string>();
  const userNameById = new Map<string, string>();
  for (const [id, user] of users) {
    if (user.suspended) {
      suspendedIds.add(id);
    }
    // 停止ユーザーも名前インデックスに入れる。落とすと残った active 1人に誤マッチする。
    userNameById.set(id, user.name);
  }
  return {
    users,
    userNameById,
    nameIndex: buildNormalizedNameIndex(userNameById),
    suspendedIds,
  };
}

export function formatReceivedCommentLine(
  yearMonth: string,
  recommenderName: string,
  comment: string,
): string {
  const body = comment.trim();
  if (body) {
    return `【${yearMonth}】${recommenderName}: ${body}`;
  }
  return `【${yearMonth}】${recommenderName}:`;
}

export function resolveNomineeFromResponse(
  response: PeerResponseRow,
  question: PeerMasterQuestion,
  usersOrLookup: Map<string, PeerUserRow> | PeerNomineeLookup,
): {
  key: string;
  name: string;
  nomineeUserId: string | null;
} | null {
  const lookup =
    usersOrLookup instanceof Map
      ? peerNomineeLookupFromUsers(usersOrLookup)
      : usersOrLookup;

  if (
    response.nominee_user_id &&
    lookup.suspendedIds.has(response.nominee_user_id)
  ) {
    return null;
  }

  const resolved = resolveNominee(
    {
      question_id: response.question_id,
      text_value: response.text_value,
      nominee_user_id: response.nominee_user_id,
    },
    question,
    lookup.userNameById,
    lookup.nameIndex,
  );
  if (!resolved) {
    return null;
  }
  if (
    resolved.nominee_user_id &&
    lookup.suspendedIds.has(resolved.nominee_user_id)
  ) {
    return null;
  }
  return {
    key: resolved.key,
    name: resolved.name,
    nomineeUserId: resolved.nominee_user_id,
  };
}

function reasonLookupKey(
  surveyId: string,
  recommenderUserId: string,
  reasonQuestionId: string,
): string {
  return `${surveyId}:${recommenderUserId}:${reasonQuestionId}`;
}

export function collectPeerNominationEvents(
  surveys: PeerSurveyRow[],
  questions: PeerMasterQuestion[],
  responses: PeerResponseRow[],
  users: Map<string, PeerUserRow>,
): PeerNominationEvent[] {
  const nominationByGroup = new Map<
    NominationGroupKey,
    { nomination: PeerMasterQuestion; reason: PeerMasterQuestion | undefined }
  >();

  for (const group of NOMINATION_GROUP_ORDER) {
    const nomination = pickNominationQuestionForGroup(questions, group);
    if (!nomination || !isNominationGroupKey(group)) continue;
    nominationByGroup.set(group, {
      nomination,
      reason: pickReasonQuestionForGroup(questions, nomination),
    });
  }

  const questionIdToGroup = new Map<string, NominationGroupKey>();
  const reasonByLookup = new Map<string, string>();

  for (const [group, pair] of nominationByGroup) {
    questionIdToGroup.set(pair.nomination.id, group);
    if (!pair.reason) continue;
    for (const response of responses) {
      if (response.question_id !== pair.reason.id) continue;
      const comment = response.text_value?.trim();
      if (!comment) continue;
      reasonByLookup.set(
        reasonLookupKey(response.survey_id, response.user_id, pair.reason.id),
        comment,
      );
    }
  }

  const surveyById = new Map(surveys.map((survey) => [survey.id, survey]));
  const lookup = peerNomineeLookupFromUsers(users);
  const events: PeerNominationEvent[] = [];

  for (const response of responses) {
    const group = questionIdToGroup.get(response.question_id);
    if (!group) continue;
    const pair = nominationByGroup.get(group);
    if (!pair) continue;
    const survey = surveyById.get(response.survey_id);
    if (!survey) continue;

    const nominee = resolveNomineeFromResponse(
      response,
      pair.nomination,
      lookup,
    );
    if (!nominee) continue;

    const recommender = users.get(response.user_id);
    const comment = pair.reason
      ? (reasonByLookup.get(
          reasonLookupKey(response.survey_id, response.user_id, pair.reason.id),
        ) ?? "")
      : "";

    events.push({
      surveyId: response.survey_id,
      yearMonth: survey.year_month,
      group,
      nomineeKey: nominee.key,
      nomineeName: nominee.name,
      nomineeUserId: nominee.nomineeUserId,
      recommenderUserId: response.user_id,
      recommenderName: recommender?.name ?? "不明",
      comment,
      isLate: Boolean(response.is_late_submission),
    });
  }

  return events;
}

export function aggregatePeerReceivedRows(
  events: PeerNominationEvent[],
  users: Map<string, PeerUserRow>,
): PeerReceivedRow[] {
  const rows = new Map<
    string,
    PeerReceivedRow & { commentLines: Record<NominationGroupKey, string[]> }
  >();

  for (const event of events) {
    let row = rows.get(event.nomineeKey);
    if (!row) {
      const user = event.nomineeUserId
        ? users.get(event.nomineeUserId)
        : undefined;
      row = {
        nomineeKey: event.nomineeKey,
        nomineeUserId: event.nomineeUserId,
        name: user?.name ?? event.nomineeName,
        companyName: user?.companyName ?? "",
        businessUnitName: user?.businessUnitName ?? "",
        totalVotes: 0,
        votesByGroup: emptyVotesByGroup(),
        commentsByGroup: emptyCommentsByGroup(),
        commentLines: {
          passionate_execution: [],
          supreme_relations: [],
          happiness_cycle: [],
          team_value: [],
        },
      };
      rows.set(event.nomineeKey, row);
    }

    row.totalVotes += 1;
    row.votesByGroup[event.group] += 1;
    row.commentLines[event.group].push(
      formatReceivedCommentLine(
        event.yearMonth,
        event.recommenderName,
        event.comment,
      ),
    );
  }

  return Array.from(rows.values())
    .map((row) => {
      const commentsByGroup = emptyCommentsByGroup();
      for (const group of NOMINATION_GROUP_ORDER) {
        commentsByGroup[group] = row.commentLines[group].join("\n");
      }
      return {
        nomineeKey: row.nomineeKey,
        nomineeUserId: row.nomineeUserId,
        name: row.name,
        companyName: row.companyName,
        businessUnitName: row.businessUnitName,
        totalVotes: row.totalVotes,
        votesByGroup: row.votesByGroup,
        commentsByGroup,
      };
    })
    .sort((a, b) => {
      if (a.totalVotes !== b.totalVotes) return b.totalVotes - a.totalVotes;
      return a.name.localeCompare(b.name, "ja");
    });
}

export function buildPeerReceivedDetailRows(
  events: PeerNominationEvent[],
): PeerReceivedDetailRow[] {
  const groupRank = new Map(
    NOMINATION_GROUP_ORDER.map((group, index) => [group, index]),
  );

  return [...events]
    .map((event) => ({
      yearMonth: event.yearMonth,
      group: event.group,
      groupLabel: AWARD_QUESTION_GROUP_LABELS[event.group] ?? event.group,
      nomineeName: event.nomineeName,
      recommenderName: event.recommenderName,
      comment: event.comment,
      isLate: event.isLate,
    }))
    .sort((a, b) => {
      if (a.yearMonth !== b.yearMonth) {
        return a.yearMonth.localeCompare(b.yearMonth);
      }
      const groupDiff =
        (groupRank.get(a.group) ?? 0) - (groupRank.get(b.group) ?? 0);
      if (groupDiff !== 0) return groupDiff;
      const nomineeDiff = a.nomineeName.localeCompare(b.nomineeName, "ja");
      if (nomineeDiff !== 0) return nomineeDiff;
      return a.recommenderName.localeCompare(b.recommenderName, "ja");
    });
}

export function buildPeerReceivedCsvContent(rows: PeerReceivedRow[]): string {
  const headers = [
    "氏名",
    "会社",
    "部署",
    "総票数",
    ...NOMINATION_GROUP_ORDER.map((group) => voteColumnLabel(group)),
    ...NOMINATION_GROUP_ORDER.map((group) => receivedCommentColumnLabel(group)),
  ];

  const dataRows = rows.map((row) => [
    row.name,
    row.companyName,
    row.businessUnitName,
    String(row.totalVotes),
    ...NOMINATION_GROUP_ORDER.map((group) => String(row.votesByGroup[group])),
    ...NOMINATION_GROUP_ORDER.map((group) => row.commentsByGroup[group]),
  ]);

  return buildCsvContent(headers, dataRows);
}

export function buildPeerReceivedDetailCsvContent(
  rows: PeerReceivedDetailRow[],
): string {
  const headers = [
    "年月",
    "バリュー",
    "被推薦者",
    "推薦者",
    "コメント",
    "期限後フラグ",
  ];

  const dataRows = rows.map((row) => [
    row.yearMonth,
    row.groupLabel,
    row.nomineeName,
    row.recommenderName,
    row.comment,
    row.isLate ? "はい" : "いいえ",
  ]);

  return buildCsvContent(headers, dataRows);
}

export function awardQuarterFilenameLabel(
  year: number,
  quarter: 1 | 2 | 3 | 4,
): string {
  return `${year}-Q${quarter}`;
}

export function awardH1FilenameLabel(year: number): string {
  return `${year}-Q1Q2`;
}
