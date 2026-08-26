import OpenAI from "openai";
import type { McpTool } from "@/lib/mcp/client";
import { mcpToolsToOpenAiTools } from "@/lib/mcp/toOpenAiTools";

const SYSTEM_PROMPT = `You are the assistant embedded in a UI backed by a live MCP server.

- Read the user's message (and the recent conversation) and decide whether one of the available
  tools can fulfil it. If so, call exactly ONE tool with the best-guess arguments extracted from the
  message and conversation.
- Only call a tool when you are confident about its required arguments. If something required is
  missing or ambiguous, do NOT call the tool — instead ask a short, specific clarifying question in
  plain text.
- If nothing in the tool list is relevant (small talk, a general question, etc.), just answer
  directly in plain text — do not force a tool call.
- Never invent data. Only use what the user told you or what a tool actually returns.`;

export interface RouterHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export type RouterOutcome =
  | { kind: "tool_call"; name: string; args: Record<string, unknown>; note?: string }
  | { kind: "text"; content: string };

export async function routeUserMessage(
  message: string,
  history: RouterHistoryMessage[],
  tools: McpTool[]
): Promise<RouterOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set on the server. Add it to .env.local and restart the app.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const openaiTools = mcpToolsToOpenAiTools(tools);

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-12).map((m) => ({ role: m.role, content: m.content }) as const),
      { role: "user", content: message },
    ],
    tools: openaiTools.length > 0 ? openaiTools : undefined,
    tool_choice: openaiTools.length > 0 ? "auto" : undefined,
  });

  const choice = completion.choices[0];
  const toolCall = choice?.message?.tool_calls?.[0];

  if (toolCall && toolCall.type === "function") {
    let args: Record<string, unknown> = {};
    try {
      args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
    } catch {
      args = {};
    }
    return {
      kind: "tool_call",
      name: toolCall.function.name,
      args,
      note: choice.message.content ?? undefined,
    };
  }

  return { kind: "text", content: choice?.message?.content ?? "I'm not sure how to help with that." };
}
