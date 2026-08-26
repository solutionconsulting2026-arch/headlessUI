// Minimal MCP "Streamable HTTP" server used only to test lib/mcp/client.ts
// end-to-end locally (the real target server, headlessmcp.vercel.app, is not
// reachable from this environment). No dependencies — plain Node http.
//
// Usage: node mock-server/mcp-server.js [port]
//
// Two endpoints are exposed so both response modes the client supports can
// be exercised:
//   POST /mcp      -> responds with a single application/json body
//   POST /mcp-sse  -> responds with a text/event-stream body (one event)

const http = require("http");

const PORT = Number(process.argv[2]) || 4001;

const TOOLS = [
  {
    name: "list_users",
    description: "Returns a list of demo users.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max number of users to return", default: 5 },
      },
    },
  },
  {
    name: "get_weather",
    description: "Returns a fake current weather reading for a city.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
        units: { type: "string", enum: ["celsius", "fahrenheit"], default: "celsius" },
      },
      required: ["city"],
    },
  },
  {
    name: "echo",
    description: "Echoes back whatever arguments it is given.",
    inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
  },
];

const USERS = [
  { id: 1, name: "Ada Lovelace", role: "Engineer", active: true },
  { id: 2, name: "Grace Hopper", role: "Admiral", active: true },
  { id: 3, name: "Alan Turing", role: "Researcher", active: false },
  { id: 4, name: "Katherine Johnson", role: "Mathematician", active: true },
  { id: 5, name: "Margaret Hamilton", role: "Engineer", active: true },
];

function handleRpc(body) {
  const { id, method, params } = body;
  const respond = (result) => ({ jsonrpc: "2.0", id, result });
  const respondError = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

  if (method === "initialize") {
    return respond({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "mock-mcp-server", version: "0.1.0" },
    });
  }

  if (method === "notifications/initialized") {
    return null; // notification, no response body
  }

  if (method === "tools/list") {
    return respond({ tools: TOOLS });
  }

  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};

    if (name === "list_users") {
      const limit = Number.isFinite(args.limit) ? args.limit : 5;
      const users = USERS.slice(0, limit);
      return respond({ structuredContent: users, content: [{ type: "text", text: JSON.stringify(users) }] });
    }

    if (name === "get_weather") {
      if (!args.city) return respondError(-32602, "city is required");
      const units = args.units === "fahrenheit" ? "fahrenheit" : "celsius";
      const tempC = 18 + (String(args.city).length % 10);
      const temperature = units === "fahrenheit" ? Math.round(tempC * 1.8 + 32) : tempC;
      const data = { city: args.city, temperature, units, condition: "Partly cloudy", humidity: 62 };
      return respond({ structuredContent: data, content: [{ type: "text", text: JSON.stringify(data) }] });
    }

    if (name === "echo") {
      return respond({ structuredContent: args, content: [{ type: "text", text: JSON.stringify(args) }] });
    }

    return respondError(-32601, `Unknown tool: ${name}`);
  }

  return respondError(-32601, `Unknown method: ${method}`);
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || (req.url !== "/mcp" && req.url !== "/mcp-sse")) {
    res.writeHead(404).end("not found");
    return;
  }

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400).end("invalid json");
      return;
    }

    const rpcResponse = handleRpc(body);
    const sessionId = "mock-session-1";

    if (rpcResponse === null) {
      res.writeHead(202, { "Mcp-Session-Id": sessionId }).end();
      return;
    }

    if (req.url === "/mcp-sse") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Mcp-Session-Id": sessionId,
      });
      res.write(`data: ${JSON.stringify(rpcResponse)}\n\n`);
      res.end();
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json", "Mcp-Session-Id": sessionId });
    res.end(JSON.stringify(rpcResponse));
  });
});

server.listen(PORT, () => {
  console.log(`Mock MCP server listening on http://localhost:${PORT}/mcp (and /mcp-sse)`);
});
