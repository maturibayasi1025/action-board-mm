export class McpToolError extends Error {
  readonly status: "invalid_input" | "not_found" | "query_failed";

  constructor(
    message: string,
    status: "invalid_input" | "not_found" | "query_failed" = "query_failed",
  ) {
    super(message);
    this.name = "McpToolError";
    this.status = status;
  }
}

export function isMcpToolError(error: unknown): error is McpToolError {
  return error instanceof McpToolError;
}
