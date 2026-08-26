/**
 * Minimal client for the MCP "Streamable HTTP" transport
 * (spec: https://modelcontextprotocol.io/specification, 2025-06-18 revision).
 *
 * Each exported function performs a self-contained handshake
 * (initialize -> notifications/initialized -> the actual call) so callers
 * don't need to keep server-side session state between requests. Servers
 * that require a persistent session id across calls are still supported
 * within a single handshake because the returned `Mcp-Session-Id` header
 * is threaded through the two follow-up requests.
 */

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: unknown;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface McpCallToolResult {
  content?: McpContentBlock[];
  structuredContent?: unknown;
  isError?: boolean;
  [key: string]: unknown;
}

const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "mcp-ui-explorer", version: "0.1.0" };

export class McpError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "McpError";
  }
}

interface RpcOutcome {
  result?: any;
  error?: { code: number; message: string; data?: unknown };
  sessionId?: string;
}

async function postJsonRpc(
  serverUrl: string,
  body: JsonRpcRequest,
  sessionId: string | undefined
): Promise<RpcOutcome> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  let res: Response;
  try {
    res = await fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    throw new McpError(`Could not reach MCP server at ${serverUrl}: ${(err as Error).message}`, err);
  }

  const returnedSessionId = res.headers.get("mcp-session-id") ?? undefined;
  const isNotification = body.id === undefined;

  if (isNotification) {
    if (!res.ok) {
      const text = await safeText(res);
      throw new McpError(`MCP notification "${body.method}" failed: ${res.status} ${res.statusText} ${text}`);
    }
    return { sessionId: returnedSessionId };
  }

  if (!res.ok) {
    const text = await safeText(res);
    throw new McpError(`MCP request "${body.method}" failed: ${res.status} ${res.statusText} ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    const message = await readSseForResponse(res, body.id);
    return { ...message, sessionId: returnedSessionId };
  }

  if (contentType.includes("application/json")) {
    const json = await res.json();
    return { result: json.result, error: json.error, sessionId: returnedSessionId };
  }

  // Some minimal servers omit/mis-set content-type; try JSON as a last resort.
  const text = await safeText(res);
  try {
    const json = JSON.parse(text);
    return { result: json.result, error: json.error, sessionId: returnedSessionId };
  } catch {
    throw new McpError(`Unexpected response content-type "${contentType}" from MCP server for "${body.method}": ${text.slice(0, 500)}`);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/** Reads an SSE stream, resolving with the JSON-RPC message whose `id` matches the request. */
function readSseForResponse(res: Response, id: number | string | undefined): Promise<{ result?: any; error?: any }> {
  return new Promise((resolve, reject) => {
    if (!res.body) {
      reject(new McpError("MCP server returned an SSE response with no body"));
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let dataLines: string[] = [];
    let resolved = false;

    const flushEvent = () => {
      if (dataLines.length === 0) return;
      const data = dataLines.join("\n");
      dataLines = [];
      let msg: any;
      try {
        msg = JSON.parse(data);
      } catch {
        return; // ignore comment/keepalive/non-JSON events
      }
      if (!resolved && msg && msg.id === id) {
        resolved = true;
        resolve({ result: msg.result, error: msg.error });
      }
    };

    (async () => {
      try {
        while (!resolved) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).replace(/\r$/, "");
            buffer = buffer.slice(idx + 1);
            if (line === "") {
              flushEvent();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).replace(/^ /, ""));
            }
            // event:, id:, retry: lines are ignored — we only need the payload.
          }
        }
        if (!resolved) {
          reject(new McpError(`SSE stream from MCP server ended without a response for id ${String(id)}`));
        }
      } catch (err) {
        if (!resolved) reject(new McpError("Error reading SSE stream from MCP server", err));
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* noop */
        }
      }
    })();
  });
}

async function handshake(serverUrl: string): Promise<string | undefined> {
  const init = await postJsonRpc(
    serverUrl,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      },
    },
    undefined
  );

  if (init.error) {
    throw new McpError(`MCP initialize failed: ${init.error.message}`);
  }

  const sessionId = init.sessionId;

  // Best-effort notification; not all servers require it, and some don't ack it.
  try {
    await postJsonRpc(serverUrl, { jsonrpc: "2.0", method: "notifications/initialized" }, sessionId);
  } catch {
    /* non-fatal */
  }

  return sessionId;
}

export async function listTools(serverUrl: string): Promise<McpTool[]> {
  const sessionId = await handshake(serverUrl);
  const res = await postJsonRpc(serverUrl, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, sessionId);
  if (res.error) {
    throw new McpError(`MCP tools/list failed: ${res.error.message}`);
  }
  const tools = res.result?.tools;
  if (!Array.isArray(tools)) {
    throw new McpError("MCP server returned an unexpected tools/list response (missing tools array)");
  }
  return tools as McpTool[];
}

export async function callTool(
  serverUrl: string,
  name: string,
  args: Record<string, unknown>
): Promise<McpCallToolResult> {
  const sessionId = await handshake(serverUrl);
  const res = await postJsonRpc(
    serverUrl,
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: args } },
    sessionId
  );
  if (res.error) {
    throw new McpError(`MCP tools/call "${name}" failed: ${res.error.message}`);
  }
  return (res.result ?? {}) as McpCallToolResult;
}
