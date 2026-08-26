"use client";

import type { McpTool } from "@/lib/mcp/client";

interface PromptSuggestionsProps {
  tools: McpTool[];
  onPick: (prompt: string) => void;
}

export default function PromptSuggestions({ tools, onPick }: PromptSuggestionsProps) {
  const suggestions = tools.slice(0, 6).map((tool) => ({
    name: tool.name,
    label: tool.description || humanizeToolName(tool.name),
  }));

  if (suggestions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {suggestions.map((s) => (
        <button
          key={s.name}
          type="button"
          onClick={() => onPick(s.label)}
          className="text-left rounded-lg border border-line bg-light-grey px-4 py-3 hover:border-accent transition"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-accent text-sm">✦</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-mid-grey">Try</span>
          </div>
          <p className="text-sm text-ink">{s.label}</p>
        </button>
      ))}
    </div>
  );
}

function humanizeToolName(name: string): string {
  return name
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
