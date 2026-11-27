import type { Tables } from "@/lib/types/supabase";
import type { User } from "@supabase/supabase-js";

export type MissionArtifact = Tables<"mission_artifacts"> & {
  geolocations?: Tables<"mission_artifact_geolocations">[];
};

export type Achievement = {
  created_at: string;
  id: string;
  mission_id: string | null;
  user_id: string | null;
};

export type SubmissionData = {
  id: string; // achievement_id
  mission_id: string;
  user_id: string;
  artifacts: MissionArtifact[];
  created_at: string;
};

export type MissionPageData = {
  mission: Tables<"missions">;
  /** 新しい順の本人の提出履歴（件数が達成回数）。取得に失敗したら null */
  submissionHistory: SubmissionData[] | null;
  totalAchievementCount: number;
  referralCode: string | null;
  mainLink: Tables<"mission_main_links"> | null;
};

export type ButtonLabelProps = {
  authUser: User | null;
  achievement: Achievement | null;
  userAchievementCount: number;
  maxAchievementCount: number | null;
};
