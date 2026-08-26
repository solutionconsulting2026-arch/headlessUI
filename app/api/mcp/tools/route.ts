import { NextRequest, NextResponse } from "next/server";
import { listTools, McpError } from "@/lib/mcp/client";
import { validateServerUrl } from "@/lib/validateServerUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const serverUrl = validateServerUrl(body.serverUrl);
    const tools = await listTools(serverUrl);
    return NextResponse.json({ tools });
  } catch (err) {
    const message = err instanceof McpError || err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
