"use client";

import { useState } from "react";
import type { ChatTurn } from "@/lib/chatTypes";
import GeneratedUiFrame from "@/components/GeneratedUiFrame";
import ResultViewer from "@/components/ResultViewer";

export default function ChatMessageBubble({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-light-grey border border-line px-4 py-3 text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
          {turn.content}
        </div>
      </div>
    );
  }

  if (turn.kind === "text") {
    return (
      <div className="flex">
        <div className="border-l-2 border-accent pl-4 max-w-[85%]">
          <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap">{turn.content}</p>
        </div>
      </div>
    );
  }

  if (turn.kind === "tool_error") {
    return (
      <div className="flex">
        <div className="border-l-2 border-accent pl-4 max-w-[85%]">
          <p className="text-sm font-semibold text-accent mb-1">Error</p>
          <p className="text-[15px] leading-relaxed text-ink">{turn.error}</p>
          <p className="text-xs text-mid-grey mt-1">
            Tool: {turn.toolName} · Arguments: {JSON.stringify(turn.args)}
          </p>
        </div>
      </div>
    );
  }

  if (turn.kind === "error") {
    return (
      <div className="flex">
        <div className="border-l-2 border-accent pl-4 max-w-[85%]">
          <p className="text-sm font-semibold text-accent mb-1">Something went wrong</p>
          <p className="text-[15px] leading-relaxed text-ink">{turn.content}</p>
        </div>
      </div>
    );
  }

  // tool_result
  return (
    <div className="flex">
      <div className="w-full max-w-2xl">
        {turn.note && <p className="text-[15px] leading-relaxed text-ink mb-3">{turn.note}</p>}
        <div className="flex items-center gap-2 mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-xs font-medium text-mid-grey">Used tool: {turn.toolName}</span>
        </div>
        <div className="rounded-lg border border-line bg-white overflow-hidden">
          <GeneratedUiFrame code={turn.code} data={turn.result} />
        </div>
        <RawDataToggle result={turn.result} />
      </div>
    </div>
  );
}

function RawDataToggle({ result }: { result: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-mid-grey hover:text-accent"
      >
        {open ? "Hide raw data" : "View raw data"}
      </button>
      {open && (
        <div className="mt-2">
          <ResultViewer data={result} />
        </div>
      )}
    </div>
  );
}
