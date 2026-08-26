export type ChatTurn =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; kind: "text"; content: string }
  | {
      id: string;
      role: "assistant";
      kind: "tool_result";
      toolName: string;
      args: Record<string, unknown>;
      result: unknown;
      code: string;
      note?: string;
    }
  | { id: string; role: "assistant"; kind: "tool_error"; toolName: string; args: Record<string, unknown>; error: string }
  | { id: string; role: "assistant"; kind: "error"; content: string };

export function newTurnId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Compact text summary of a turn, used as OpenAI chat history so follow-ups have context. */
export function turnToHistoryEntry(turn: ChatTurn): { role: "user" | "assistant"; content: string } | null {
  if (turn.role === "user") return { role: "user", content: turn.content };
  if (turn.kind === "text") return { role: "assistant", content: turn.content };
  if (turn.kind === "tool_result") {
    const resultPreview = safeSlice(turn.result);
    return {
      role: "assistant",
      content: `Called tool "${turn.toolName}" with arguments ${JSON.stringify(turn.args)} and got: ${resultPreview}`,
    };
  }
  if (turn.kind === "tool_error") {
    return { role: "assistant", content: `Tried to call tool "${turn.toolName}" but it failed: ${turn.error}` };
  }
  return null;
}

function safeSlice(value: unknown, maxChars = 400): string {
  let json: string;
  try {
    json = JSON.stringify(value) ?? "null";
  } catch {
    json = String(value);
  }
  return json.length > maxChars ? `${json.slice(0, maxChars)}…` : json;
}
