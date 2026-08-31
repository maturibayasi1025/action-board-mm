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
];

export const MCP_TOOL_BY_NAME = new Map(
  MCP_TOOLS.map((tool) => [tool.name, tool]),
);
