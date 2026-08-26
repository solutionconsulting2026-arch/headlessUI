import type { McpTool } from "./client";

export interface OpenAiToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Converts MCP tool definitions into the shape OpenAI's function-calling API expects. */
export function mcpToolsToOpenAiTools(tools: McpTool[]): OpenAiToolDef[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: normalizeSchema(tool.inputSchema),
    },
  }));
}

function normalizeSchema(schema: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || !("type" in schema)) {
    return { type: "object", properties: {} };
  }
  return schema;
}
