import { NextRequest, NextResponse } from "next/server";
import { callTool, McpError } from "@/lib/mcp/client";
import { validateServerUrl } from "@/lib/validateServerUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const serverUrl = validateServerUrl(body.serverUrl);
    const name = body.name;
    if (typeof name !== "string" || !name) {
      return NextResponse.json({ error: "name (tool name) is required" }, { status: 400 });
    }
    const args = body.arguments && typeof body.arguments === "object" ? body.arguments : {};
    const result = await callTool(serverUrl, name, args);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof McpError || err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
