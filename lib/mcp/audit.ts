export type McpAuditEntry = {
  keyId: string;
  tool: string;
  latencyMs: number;
  rowCount: number | null;
  ok: boolean;
};

export function logMcpAudit(entry: McpAuditEntry): void {
  console.info(
    "[mcp]",
    JSON.stringify({
      ...entry,
      at: new Date().toISOString(),
    }),
  );
}

export function inferRowCount(payload: unknown): number | null {
  if (Array.isArray(payload)) {
    return payload.length;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return record.items.length;
    }
    if (Array.isArray(record.rows)) {
      return record.rows.length;
    }
  }
  return payload == null ? 0 : 1;
}
