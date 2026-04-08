import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 付与URL用の平文シークレット（DB には保存しない） */
export function generateLateSubmissionSecret(): string {
  return randomBytes(32).toString("hex");
}

/** DB の token_hash と同一（PostgreSQL digest ... sha256 hex） */
export function hashLateSubmissionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
