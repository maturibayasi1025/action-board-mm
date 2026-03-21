import type { Tables } from "@/lib/types/supabase";

export type LinkedPostMissionContext = {
  mission: Tables<"missions">;
  userAchievementCount: number;
};
