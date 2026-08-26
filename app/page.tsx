"use client";

import { useState } from "react";
import type { McpCallToolResult, McpTool } from "@/lib/mcp/client";
import { extractResultData } from "@/lib/extractResultData";
import SchemaForm from "@/components/SchemaForm";
import ResultViewer from "@/components/ResultViewer";
import GeneratedUiFrame from "@/components/GeneratedUiFrame";

type Status = "idle" | "loading" | "error";

const DEFAULT_SERVER_URL = process.env.NEXT_PUBLIC_DEFAULT_MCP_SERVER_URL || "https://headlessmcp.vercel.app/mcp";

export default function Page() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [connectStatus, setConnectStatus] = useState<Status>("idle");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);

  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);

  const [callStatus, setCallStatus] = useState<Status>("idle");
  const [callError, setCallError] = useState<string | null>(null);
  const [lastArgs, setLastArgs] = useState<Record<string, unknown> | null>(null);
  const [lastResult, setLastResult] = useState<McpCallToolResult | null>(null);

  const [instructions, setInstructions] = useState("");
  const [generateStatus, setGenerateStatus] = useState<Status>("idle");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnectStatus("loading");
    setConnectError(null);
    setTools([]);
    setSelectedTool(null);
    setLastResult(null);
    setGeneratedCode(null);
    try {
      const res = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setTools(body.tools);
      setConnectStatus("idle");
    } catch (err) {
      setConnectStatus("error");
      setConnectError((err as Error).message);
    }
  }

  function selectTool(tool: McpTool) {
    setSelectedTool(tool);
    setLastResult(null);
    setCallError(null);
    setGeneratedCode(null);
    setGenerateError(null);
    setInstructions("");
  }

  async function handleCallTool(args: Record<string, unknown>) {
    if (!selectedTool) return;
    setCallStatus("loading");
    setCallError(null);
    setGeneratedCode(null);
    setGenerateError(null);
    try {
      const res = await fetch("/api/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl, name: selectedTool.name, arguments: args }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setLastArgs(args);
      setLastResult(body.result);
      setCallStatus("idle");
    } catch (err) {
      setCallStatus("error");
      setCallError((err as Error).message);
    }
  }

  async function handleGenerateUi() {
    if (!selectedTool || !lastResult) return;
    setGenerateStatus("loading");
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: selectedTool.name,
          toolDescription: selectedTool.description,
          args: lastArgs,
          result: extractResultData(lastResult),
          instructions,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setGeneratedCode(body.code);
      setGenerateStatus("idle");
    } catch (err) {
      setGenerateStatus("error");
      setGenerateError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink">MCP UI Explorer</h1>
        <p className="text-slate-500 mt-1">
          Connect to any MCP server, call its tools, and let AI generate a React UI for the result — the same idea
          behind generative UI in Claude, rendered here with the OpenAI API.
        </p>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">1. Connect to an MCP server</h2>
        <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://headlessmcp.vercel.app/mcp"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={connectStatus === "loading"}
            className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {connectStatus === "loading" ? "Connecting…" : "Connect & list tools"}
          </button>
        </form>
        {connectError && <p className="text-sm text-red-600 mt-2">{connectError}</p>}
        {tools.length > 0 && (
          <p className="text-sm text-emerald-600 mt-2">
            Connected — {tools.length} tool{tools.length === 1 ? "" : "s"} available.
          </p>
        )}
      </section>

      {tools.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm md:col-span-1">
            <h2 className="text-sm font-semibold text-slate-600 mb-3">2. Pick a tool</h2>
            <ul className="space-y-1 max-h-96 overflow-auto">
              {tools.map((tool) => (
                <li key={tool.name}>
                  <button
                    type="button"
                    onClick={() => selectTool(tool)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                      selectedTool?.name === tool.name ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-medium">{tool.name}</div>
                    {tool.description && <div className="text-xs text-slate-400 line-clamp-2">{tool.description}</div>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-600 mb-3">3. Call it</h2>
            {!selectedTool ? (
              <p className="text-sm text-slate-400">Select a tool on the left to see its arguments.</p>
            ) : (
              <>
                {selectedTool.description && <p className="text-sm text-slate-500 mb-4">{selectedTool.description}</p>}
                <SchemaForm schema={selectedTool.inputSchema} onSubmit={handleCallTool} submitting={callStatus === "loading"} />
                {callError && <p className="text-sm text-red-600 mt-3">{callError}</p>}
              </>
            )}
          </div>
        </section>
      )}

      {lastResult && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">4. Result</h2>
          <ResultViewer data={extractResultData(lastResult)} />
        </section>
      )}

      {lastResult && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">5. Generate a UI for it</h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Optional: describe how you want it presented (e.g. 'as a bar chart', 'compact cards')"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={handleGenerateUi}
              disabled={generateStatus === "loading"}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {generateStatus === "loading" ? "Generating…" : "Generate UI with AI"}
            </button>
          </div>
          {generateError && <p className="text-sm text-red-600 mb-3">{generateError}</p>}
          {generatedCode && <GeneratedUiFrame code={generatedCode} data={extractResultData(lastResult)} />}
        </section>
      )}
    </main>
  );
}
