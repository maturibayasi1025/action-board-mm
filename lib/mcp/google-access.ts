import { type McpScope, isMcpScope } from "@/lib/mcp/scopes";
import { z } from "zod";

export const DEFAULT_GOOGLE_DOMAIN = "maisonmarc.com";

export type GoogleAllowlistEntry = {
  email: string;
  scopes: McpScope[];
};

export type GoogleIdentity = {
  email: string;
  emailVerified: boolean;
  hostedDomain: string | null;
};

export type GoogleAccessOk = {
  ok: true;
  email: string;
  scopes: McpScope[];
};

export type GoogleAccessDenied = {
  ok: false;
  reason:
    | "unverified"
    | "wrong_domain"
    | "missing_hd"
    | "allowlist_empty"
    | "not_allowlisted";
};

export type GoogleAccessDecision = GoogleAccessOk | GoogleAccessDenied;

const allowlistEntrySchema = z.object({
  email: z.string().email(),
  scopes: z.array(z.string()).optional(),
});

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAllowedGoogleDomain(raw: string | undefined): string {
  const domain = raw?.trim().toLowerCase();
  return domain && domain.length > 0 ? domain : DEFAULT_GOOGLE_DOMAIN;
}

export function parseAllowedGoogleEmails(
  raw: string | undefined,
): GoogleAllowlistEntry[] {
  if (!raw || raw.trim() === "") {
    return [];
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return [];
      }
      const entries: GoogleAllowlistEntry[] = [];
      for (const item of parsed) {
        if (typeof item === "string") {
          entries.push({
            email: normalizeEmail(item),
            scopes: ["public"],
          });
          continue;
        }
        const result = allowlistEntrySchema.safeParse(item);
        if (!result.success) {
          continue;
        }
        const scopes = (result.data.scopes ?? ["public"]).filter(isMcpScope);
        if (scopes.length === 0) {
          continue;
        }
        entries.push({
          email: normalizeEmail(result.data.email),
          scopes,
        });
      }
      return entries;
    } catch {
      return [];
    }
  }
  return trimmed
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter((email) => email.includes("@"))
    .map((email) => ({ email, scopes: ["public"] as McpScope[] }));
}

export function evaluateGoogleAccess(
  identity: GoogleIdentity,
  options: {
    domain: string;
    allowlist: GoogleAllowlistEntry[];
  },
): GoogleAccessDecision {
  const email = normalizeEmail(identity.email);
  if (!identity.emailVerified) {
    return { ok: false, reason: "unverified" };
  }
  const expectedDomain = options.domain.toLowerCase();
  if (!email.endsWith(`@${expectedDomain}`)) {
    return { ok: false, reason: "wrong_domain" };
  }
  const hd = identity.hostedDomain?.trim().toLowerCase() ?? null;
  if (hd !== expectedDomain) {
    return { ok: false, reason: "missing_hd" };
  }
  if (options.allowlist.length === 0) {
    return { ok: false, reason: "allowlist_empty" };
  }
  const entry = options.allowlist.find((item) => item.email === email);
  if (!entry) {
    return { ok: false, reason: "not_allowlisted" };
  }
  return { ok: true, email, scopes: entry.scopes };
}
