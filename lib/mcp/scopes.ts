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

/** API キーだけでは出さない。Google JWT（email あり）が必要。 */
export const GOOGLE_REQUIRED_SCOPES: readonly McpScope[] = [
  "slack_directory",
  "survey_raw",
];

export function requiresGoogleIdentity(required: readonly McpScope[]): boolean {
  return required.some((scope) =>
    (GOOGLE_REQUIRED_SCOPES as readonly McpScope[]).includes(scope),
  );
}

export function canAccessMcpTool(
  principal: { scopes: readonly McpScope[]; email: string | null },
  required: readonly McpScope[],
): boolean {
  if (!hasAllScopes(principal.scopes, required)) {
    return false;
  }
  if (requiresGoogleIdentity(required) && principal.email == null) {
    return false;
  }
  return true;
}

export function canExposeSlackUserId(principal: {
  scopes: readonly McpScope[];
  email: string | null;
}): boolean {
  return canAccessMcpTool(principal, ["slack_directory"]);
}
