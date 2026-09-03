export type McpAuditEntry = {
  keyId: string;
  email: string | null;
  tool: string;
  latencyMs: number;
  rowCount: number | null;
  ok: boolean;
  surveyId?: string | null;
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
    if (typeof record.row_count === "number") {
      return record.row_count;
    }
    if (Array.isArray(record.items)) {
      return record.items.length;
    }
    if (Array.isArray(record.rows)) {
      return record.rows.length;
    }
  }
  return payload == null ? 0 : 1;
}

export function inferSurveyId(input: unknown, payload: unknown): string | null {
  const fromInput = readSurveyId(input);
  if (fromInput) {
    return fromInput;
  }
  return readSurveyId(payload);
}

function readSurveyId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const surveyId = (value as Record<string, unknown>).survey_id;
  return typeof surveyId === "string" && surveyId.length > 0 ? surveyId : null;
}
