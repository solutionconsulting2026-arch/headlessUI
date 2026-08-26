"use client";

import { useMemo, useState } from "react";

interface ResultViewerProps {
  data: unknown;
}

/** Best-effort auto rendering of a tool result: a table for arrays of objects, otherwise pretty JSON. */
export default function ResultViewer({ data }: ResultViewerProps) {
  const [view, setView] = useState<"auto" | "json">("auto");
  const rows = useMemo(() => asTableRows(data), [data]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ToggleButton active={view === "auto"} onClick={() => setView("auto")}>
          Preview
        </ToggleButton>
        <ToggleButton active={view === "json"} onClick={() => setView("json")}>
          Raw JSON
        </ToggleButton>
      </div>

      {view === "json" || !rows ? (
        <pre className="max-h-96 overflow-auto rounded-lg bg-ink text-white text-xs p-4 leading-relaxed">
          {safeStringify(data)}
        </pre>
      ) : (
        <div className="overflow-auto max-h-96 rounded-lg border border-line">
          <table className="min-w-full text-sm">
            <thead className="bg-light-grey sticky top-0">
              <tr>
                {rows.columns.map((col) => (
                  <th key={col} className="text-left font-semibold text-dark-grey px-3 py-2 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-light-grey"}>
                  {rows.columns.map((col) => (
                    <td key={col} className="px-3 py-2 align-top text-ink whitespace-pre-wrap">
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1 rounded-full border transition ${
        active ? "bg-accent text-white border-accent" : "bg-white text-dark-grey border-line hover:bg-light-grey"
      }`}
    >
      {children}
    </button>
  );
}

function asTableRows(data: unknown): { columns: string[]; rows: Record<string, unknown>[] } | null {
  const candidate: unknown[] | null = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.items)
    ? (data as any).items
    : null;
  if (!candidate || candidate.length === 0) return null;
  if (!candidate.every((item) => item && typeof item === "object" && !Array.isArray(item))) return null;

  const rows = candidate as Record<string, unknown>[];
  const columns = Array.from(new Set(rows.flatMap((item) => Object.keys(item))));
  if (columns.length === 0 || columns.length > 12) return null;

  return { columns, rows };
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2) ?? "null";
  } catch {
    return String(data);
  }
}
