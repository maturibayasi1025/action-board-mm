import {
  getMissionTool,
  listAchievementsTool,
  listMissionCategoriesTool,
  listMissionsTool,
} from "@/lib/mcp/tools/missions";
import {
  getPublicProfileTool,
  getUserLevelTool,
  listBusinessUnitsTool,
  listUserBadgesTool,
  searchPublicProfilesTool,
} from "@/lib/mcp/tools/profiles";
import {
  getLikesRankingTool,
  getMissionRankingTool,
  getPrefectureRankingTool,
  getXpRankingTool,
} from "@/lib/mcp/tools/rankings";
import {
  getSlackUserIdTool,
  listSlackDirectoryTool,
} from "@/lib/mcp/tools/slack-directory";
import {
  getAwardResponseTool,
  getEnpsResponseTool,
  listAwardResponsesTool,
  listEnpsResponsesTool,
} from "@/lib/mcp/tools/survey-responses";
import {
  getAwardNominationRankingTool,
  getEnpsMonthlySnapshotsTool,
  listEnpsSurveysTool,
} from "@/lib/mcp/tools/surveys";
import { type RegisteredMcpTool, registerTool } from "@/lib/mcp/tools/types";
import { listUserMissionsTool } from "@/lib/mcp/tools/user-missions";

export const MCP_TOOLS: RegisteredMcpTool[] = [
  registerTool(listMissionsTool),
  registerTool(getMissionTool),
  registerTool(listMissionCategoriesTool),
  registerTool(listAchievementsTool),
  registerTool(getPublicProfileTool),
  registerTool(searchPublicProfilesTool),
  registerTool(getUserLevelTool),
  registerTool(listUserBadgesTool),
  registerTool(listUserMissionsTool),
  registerTool(getXpRankingTool),
  registerTool(getMissionRankingTool),
  registerTool(getLikesRankingTool),
  registerTool(getPrefectureRankingTool),
  registerTool(listBusinessUnitsTool),
  registerTool(listEnpsSurveysTool),
  registerTool(getEnpsMonthlySnapshotsTool),
  registerTool(getAwardNominationRankingTool),
  registerTool(listSlackDirectoryTool),
  registerTool(getSlackUserIdTool),
  registerTool(listEnpsResponsesTool),
  registerTool(listAwardResponsesTool),
  registerTool(getEnpsResponseTool),
  registerTool(getAwardResponseTool),
];

export const MCP_TOOL_BY_NAME = new Map(
  MCP_TOOLS.map((tool) => [tool.name, tool]),
);
