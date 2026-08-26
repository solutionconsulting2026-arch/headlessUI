import type { McpCallToolResult } from "@/lib/mcp/client";

/** Pulls the most useful JS value out of an MCP tools/call result for display and for the AI UI generator. */
export function extractResultData(result: McpCallToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;

  const blocks = result.content ?? [];
  const textBlocks = blocks.filter((b) => b.type === "text" && typeof b.text === "string");

  if (textBlocks.length === 1) {
    return tryParseJson(textBlocks[0].text as string);
  }

  if (textBlocks.length > 1) {
    return textBlocks.map((b) => tryParseJson(b.text as string));
  }

  if (blocks.length > 0) return blocks;

  return result;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
