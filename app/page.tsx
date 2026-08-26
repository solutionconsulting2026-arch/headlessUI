"use client";

import { useEffect, useRef, useState } from "react";
import type { McpTool } from "@/lib/mcp/client";
import { type ChatTurn, newTurnId, turnToHistoryEntry } from "@/lib/chatTypes";
import ChatMessageBubble from "@/components/ChatMessageBubble";
import PromptSuggestions from "@/components/PromptSuggestions";
import ServerSettings from "@/components/ServerSettings";

const DEFAULT_SERVER_URL = process.env.NEXT_PUBLIC_DEFAULT_MCP_SERVER_URL || "https://headlessmcp.vercel.app/mcp";

type ConnectStatus = "idle" | "loading" | "connected" | "error";

export default function Page() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>("idle");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connect(serverUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  async function connect(url: string) {
    setConnectStatus("loading");
    setConnectError(null);
    try {
      const res = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl: url }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setTools(body.tools);
      setConnectStatus("connected");
    } catch (err) {
      setConnectStatus("error");
      setConnectError((err as Error).message);
    }
  }

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    const userTurn: ChatTurn = { id: newTurnId(), role: "user", content: message };
    const history = turns.map(turnToHistoryEntry).filter((h): h is NonNullable<typeof h> => h !== null);

    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl, tools, history, message }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);

      let assistantTurn: ChatTurn;
      if (body.kind === "text") {
        assistantTurn = { id: newTurnId(), role: "assistant", kind: "text", content: body.content };
      } else if (body.kind === "tool_result") {
        assistantTurn = {
          id: newTurnId(),
          role: "assistant",
          kind: "tool_result",
          toolName: body.toolName,
          args: body.args,
          result: body.result,
          code: body.code,
          note: body.note,
        };
      } else {
        assistantTurn = {
          id: newTurnId(),
          role: "assistant",
          kind: "tool_error",
          toolName: body.toolName,
          args: body.args,
          error: body.error,
        };
      }
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      setTurns((prev) => [...prev, { id: newTurnId(), role: "assistant", kind: "error", content: (err as Error).message }]);
    } finally {
      setSending(false);
    }
  }

  const greeting = timeGreeting();

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-line relative">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 bg-accent rounded-sm" />
          <h1 className="text-lg font-bold text-ink">MCP UI Explorer</h1>
        </div>
        <ServerSettings
          serverUrl={serverUrl}
          onServerUrlChange={setServerUrl}
          onReconnect={() => connect(serverUrl)}
          status={connectStatus}
          error={connectError}
          toolCount={tools.length}
        />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {turns.length === 0 ? (
            <div>
              <h2 className="text-3xl font-bold text-ink mb-1">{greeting}</h2>
              <p className="text-mid-grey mb-8">What would you like to do?</p>
              {connectStatus === "connected" && <PromptSuggestions tools={tools} onPick={sendMessage} />}
              {connectStatus === "error" && (
                <p className="text-sm text-accent">Couldn&apos;t connect to the MCP server: {connectError}</p>
              )}
              {connectStatus === "loading" && <p className="text-sm text-mid-grey">Connecting to MCP server…</p>}
            </div>
          ) : (
            <div className="space-y-6">
              {turns.map((turn) => (
                <ChatMessageBubble key={turn.id} turn={turn} />
              ))}
              {sending && (
                <div className="flex">
                  <div className="border-l-2 border-accent pl-4">
                    <span className="text-sm text-mid-grey">Thinking…</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="max-w-3xl mx-auto flex items-center gap-3 rounded-full border border-line bg-light-grey px-4 py-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data, or tell it what to do…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-mid-grey focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="flex items-center justify-center h-8 w-8 rounded-full bg-accent text-white disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
