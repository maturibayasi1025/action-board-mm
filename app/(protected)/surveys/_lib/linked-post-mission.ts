import { getMissionData } from "@/app/missions/[id]/_lib/data";
import { createClient } from "@/lib/supabase/server";

import type { LinkedPostMissionContext } from "./linked-post-mission.types";
import { hasAchievementInActiveSurveyPeriod } from "./survey-linked-achievement-in-period";

export type SurveyKind = "enps" | "award";

export type { LinkedPostMissionContext } from "./linked-post-mission.types";

/** env で紐づけたアンケート連携ミッションか（達成時の前提チェックに利用） */
export function getSurveyLinkedMissionKind(
  missionId: string,
): SurveyKind | null {
  const enps = process.env.SURVEY_ENPS_POST_MISSION_ID?.trim();
  const award = process.env.SURVEY_AWARD_POST_MISSION_ID?.trim();
  if (award && missionId === award) {
    return "award";
  }
  if (enps && missionId === enps) {
    return "enps";
  }
  return null;
}

/**
 * アンケート回答後に案内するグッジョブ（env のミッション ID）。
 * 未設定・ユーザーなし・ミッション不在のときは null。
 */
export async function getLinkedPostMissionContext(
  surveyKind: SurveyKind,
  userId: string | undefined,
): Promise<LinkedPostMissionContext | null> {
  const rawId =
    surveyKind === "enps"
      ? process.env.SURVEY_ENPS_POST_MISSION_ID
      : process.env.SURVEY_AWARD_POST_MISSION_ID;

  const missionId = rawId?.trim();
  if (!userId || !missionId) {
    return null;
  }

  const mission = await getMissionData(missionId);
  if (!mission) {
    return null;
  }

  const supabase = await createClient();
  const alreadyRecordedInActiveSurveyPeriod =
    await hasAchievementInActiveSurveyPeriod(
      supabase,
      userId,
      missionId,
      surveyKind,
    );

  return { mission, alreadyRecordedInActiveSurveyPeriod };
}
