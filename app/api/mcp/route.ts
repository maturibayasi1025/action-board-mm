import { handleMcpHttp } from "@/lib/mcp/http";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  return handleMcpHttp(request);
}

export async function OPTIONS(request: NextRequest) {
  return handleMcpHttp(request);
}

export async function GET(request: NextRequest) {
  return handleMcpHttp(request);
}
