import type { Tables } from "@/lib/types/supabase";

/** アンケート連携グッジョブ。受付期間中は 1 ユーザー 1 回のみ記録可（サーバーでも検証）。 */
export type LinkedPostMissionContext = {
  mission: Tables<"missions">;
  /** いま受付中の当該アンケート期間内に、すでにこのミッションを達成済み */
  alreadyRecordedInActiveSurveyPeriod: boolean;
};
