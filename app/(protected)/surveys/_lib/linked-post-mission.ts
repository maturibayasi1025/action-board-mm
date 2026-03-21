import {
  getMissionData,
  getUserAchievements,
} from "@/app/missions/[id]/_lib/data";

import type { LinkedPostMissionContext } from "./linked-post-mission.types";

export type SurveyKind = "enps" | "award";

export type { LinkedPostMissionContext } from "./linked-post-mission.types";

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

  const { count } = await getUserAchievements(userId, mission.id);
  return { mission, userAchievementCount: count };
}
