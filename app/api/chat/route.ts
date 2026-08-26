import { NextRequest, NextResponse } from "next/server";
import { callTool, McpError, type McpTool } from "@/lib/mcp/client";
import { validateServerUrl } from "@/lib/validateServerUrl";
import { routeUserMessage, type RouterHistoryMessage } from "@/lib/openai/chatRouter";
import { generateUiHtml } from "@/lib/openai/generateUi";
import { extractResultData } from "@/lib/extractResultData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const serverUrl = validateServerUrl(body.serverUrl);

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const tools: McpTool[] = Array.isArray(body.tools) ? body.tools : [];
    const history: RouterHistoryMessage[] = Array.isArray(body.history) ? body.history : [];

    const outcome = await routeUserMessage(message, history, tools);

    if (outcome.kind === "text") {
      return NextResponse.json({ kind: "text", content: outcome.content });
    }

    const tool = tools.find((t) => t.name === outcome.name);

    let callResult;
    try {
      callResult = await callTool(serverUrl, outcome.name, outcome.args);
    } catch (err) {
      const errorMessage = err instanceof McpError || err instanceof Error ? err.message : "Unknown error calling tool";
      return NextResponse.json({
        kind: "tool_error",
        toolName: outcome.name,
        args: outcome.args,
        error: errorMessage,
      });
    }

    const resultData = extractResultData(callResult);

    const ui = await generateUiHtml({
      toolName: outcome.name,
      toolDescription: tool?.description,
      args: outcome.args,
      result: resultData,
      instructions: message,
    });

    return NextResponse.json({
      kind: "tool_result",
      toolName: outcome.name,
      args: outcome.args,
      result: resultData,
      code: ui.code,
      note: outcome.note,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
