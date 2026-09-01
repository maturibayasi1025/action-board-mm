import { verifyHs256Jwt } from "@/lib/mcp/jwt";
import { type McpScope, isMcpScope } from "@/lib/mcp/scopes";
import { z } from "zod";

export type McpPrincipal = {
  keyId: string;
  scopes: McpScope[];
  label: string | null;
  email: string | null;
};

const keySchema = z.object({
  id: z.string().min(1),
  secret: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  label: z.string().optional(),
});

export function parseMcpApiKeys(raw: string | undefined): McpPrincipalSecret[] {
  if (!raw || raw.trim() === "") {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[mcp] MCP_API_KEYS is not valid JSON");
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error("[mcp] MCP_API_KEYS must be a JSON array");
    return [];
  }

  const keys: McpPrincipalSecret[] = [];
  for (const item of parsed) {
    const result = keySchema.safeParse(item);
    if (!result.success) {
      console.error("[mcp] skipped invalid MCP_API_KEYS entry");
      continue;
    }
    const scopes = result.data.scopes.filter(isMcpScope);
    if (scopes.length === 0) {
      console.error("[mcp] skipped MCP_API_KEYS entry without valid scopes");
      continue;
    }
    keys.push({
      keyId: result.data.id,
      secret: result.data.secret,
      scopes,
      label: result.data.label ?? null,
      email: null,
    });
  }
  return keys;
}

export type McpPrincipalSecret = McpPrincipal & { secret: string };

export function extractBearerToken(
  authorization: string | null,
): string | null {
  if (!authorization) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) {
    return null;
  }
  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

export type AuthenticateMcpOptions = {
  rawKeys?: string;
  jwtSecret?: string;
};

export async function authenticateMcpRequest(
  authorization: string | null,
  rawKeysOrOptions?: string | AuthenticateMcpOptions,
): Promise<McpPrincipal | null> {
  const token = extractBearerToken(authorization);
  if (!token) {
    return null;
  }
  const options: AuthenticateMcpOptions =
    typeof rawKeysOrOptions === "string" || rawKeysOrOptions === undefined
      ? { rawKeys: rawKeysOrOptions }
      : rawKeysOrOptions;
  const keys = parseMcpApiKeys(options.rawKeys ?? process.env.MCP_API_KEYS);
  const tokenDigest = await sha256Bytes(token);
  let matched: McpPrincipal | null = null;
  for (const key of keys) {
    const secretDigest = await sha256Bytes(key.secret);
    if (equalBytes(tokenDigest, secretDigest)) {
      matched = {
        keyId: key.keyId,
        scopes: key.scopes,
        label: key.label,
        email: null,
      };
    }
  }
  if (matched) {
    return matched;
  }
  const jwtSecret = options.jwtSecret ?? process.env.MCP_JWT_SECRET;
  if (!jwtSecret) {
    return null;
  }
  const payload = await verifyHs256Jwt<{
    typ?: string;
    email?: string;
    scopes?: string[];
    sub?: string;
  }>(token, jwtSecret);
  if (!payload || payload.typ !== "mcp_at" || !payload.email) {
    return null;
  }
  const scopes = (payload.scopes ?? []).filter(isMcpScope);
  if (scopes.length === 0) {
    return null;
  }
  return {
    keyId: `google:${payload.email}`,
    scopes,
    label: payload.email,
    email: payload.email,
  };
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}
