# MCP UI Explorer

A small Next.js app that:

1. Connects to any MCP server over the **Streamable HTTP** transport (defaults to
   [`https://headlessmcp.vercel.app/mcp`](https://headlessmcp.vercel.app/mcp)) and lists its tools.
2. Lets you fill in a tool's arguments (a form is generated from the tool's JSON Schema) and call it.
3. Shows the raw result, then — on demand — asks the OpenAI API to write a small React component
   that presents that specific result well, and renders it live. This is the same idea behind
   generative UI in Claude/ChatGPT apps: the model writes UI code, not just text.

## Architecture

```
Browser (React UI)
   │
   ├─▶ POST /api/mcp/tools   ──▶ lib/mcp/client.ts ──▶ target MCP server (initialize, tools/list)
   ├─▶ POST /api/mcp/call    ──▶ lib/mcp/client.ts ──▶ target MCP server (initialize, tools/call)
   └─▶ POST /api/generate-ui ──▶ lib/openai/generateUi.ts ──▶ OpenAI Chat Completions
```

- **`lib/mcp/client.ts`** is a dependency-free MCP client for the
  [Streamable HTTP transport](https://modelcontextprotocol.io/specification). It performs a fresh
  `initialize` → `notifications/initialized` → request handshake per call (so no server-side
  session state is needed between HTTP requests to this app) and transparently handles both
  response modes a compliant server may use: a single `application/json` body or a
  `text/event-stream` (SSE) body carrying one JSON-RPC message.
- The MCP calls happen **server-side** (in the API routes), not from the browser, so the app works
  regardless of the target server's CORS policy and never exposes the `OPENAI_API_KEY` to the
  client.
- **`GeneratedUiFrame`** renders the AI-generated component inside a sandboxed `<iframe
  sandbox="allow-scripts">` (no `allow-same-origin`) with React/ReactDOM/Babel Standalone loaded
  from a CDN *inside that isolated frame*. The generated code runs in a unique, opaque origin — it
  cannot read this page's DOM, cookies, or localStorage, and cannot navigate the parent — regardless
  of what the model writes.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in OPENAI_API_KEY
npm run dev
```

Open http://localhost:3000, keep the default server URL (or point it at any other MCP server that
speaks Streamable HTTP), click **Connect & list tools**, pick a tool, call it, and optionally click
**Generate UI with AI**.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes, for step 3 (UI generation) | Server-side only OpenAI API key. |
| `OPENAI_MODEL` | No | Chat model used to generate the UI. Defaults to `gpt-4o-mini`. |
| `NEXT_PUBLIC_DEFAULT_MCP_SERVER_URL` | No | Pre-fills the server URL field. Defaults to `https://headlessmcp.vercel.app/mcp`. |

## Testing without network access to a real MCP server

`mock-server/mcp-server.js` is a ~150-line, dependency-free MCP server implementing both response
modes (plain JSON and SSE) with three demo tools (`list_users`, `get_weather`, `echo`). It was used
to validate `lib/mcp/client.ts` end-to-end in an environment where the public internet wasn't
reachable, and is kept so the pipeline can be exercised offline / in CI:

```bash
npm run mock:mcp          # starts http://localhost:4001/mcp and /mcp-sse
# in another terminal
npm run dev
# then point the "Connect to an MCP server" field at http://localhost:4001/mcp
```

## Notes / limitations

- `SchemaForm` auto-generates inputs for flat `string` / `number` / `integer` / `boolean` / `enum` /
  primitive-array schema properties; anything more complex (nested objects, arrays of objects,
  `oneOf`/`anyOf`) falls back to a raw-JSON editor for that field, and there's always an "Edit as
  raw JSON" escape hatch for the whole form.
- `ResultViewer` auto-renders a table when the result is an array of uniform objects, otherwise
  falls back to pretty-printed JSON; both are always one click away via the Preview/Raw JSON toggle.
- UI generation is only triggered on demand (a button click) so a tool call never implies an OpenAI
  API cost.

## Note on this repo

A `package-lock.json` is intentionally not committed (see project setup notes); run `npm install`
once after cloning to generate it locally.
