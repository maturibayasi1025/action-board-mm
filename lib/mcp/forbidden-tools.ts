export const NEVER_REGISTERED_TOOL_NAMES = [
  "execute_sql",
  "replace_enps_responses",
  "replace_award_responses",
  "get_user_by_email",
] as const;

export const RESTRICTED_TOOL_NAMES = [
  "list_enps_responses",
  "list_award_responses",
  "get_enps_response",
  "get_award_response",
  "export_enps_responses_csv",
  "export_award_responses_csv",
  "list_slack_directory",
  "get_slack_user_id",
] as const;

export const SURVEY_AGG_TOOL_NAMES = [
  "list_enps_surveys",
  "get_enps_monthly_snapshots",
  "get_award_nomination_ranking",
] as const;

/** Phase 1 テスト互換。未登録のままにするツール。 */
export const PHASE1_FORBIDDEN_TOOL_NAMES = NEVER_REGISTERED_TOOL_NAMES;
