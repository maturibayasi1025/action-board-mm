export const MCP_SCOPES = [
  "public",
  "analytics",
  "survey_agg",
  "slack_directory",
  "survey_raw",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export function isMcpScope(value: string): value is McpScope {
  return (MCP_SCOPES as readonly string[]).includes(value);
}

export function hasAllScopes(
  granted: readonly McpScope[],
  required: readonly McpScope[],
): boolean {
  return required.every((scope) => granted.includes(scope));
}
