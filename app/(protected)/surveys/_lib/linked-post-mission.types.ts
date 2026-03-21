import type { Tables } from "@/lib/types/supabase";

/** アンケート連携グッジョブ。記録可否はアンケート回答のみで判定し、達成回数は見ない。 */
export type LinkedPostMissionContext = {
  mission: Tables<"missions">;
};
