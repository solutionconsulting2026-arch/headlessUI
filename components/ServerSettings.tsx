"use client";

import { useState } from "react";

type ConnectStatus = "idle" | "loading" | "connected" | "error";

interface ServerSettingsProps {
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
  onReconnect: () => void;
  status: ConnectStatus;
  error: string | null;
  toolCount: number;
}

export default function ServerSettings({
  serverUrl,
  onServerUrlChange,
  onReconnect,
  status,
  error,
  toolCount,
}: ServerSettingsProps) {
  const [open, setOpen] = useState(false);

  const dotColor = status === "connected" ? "bg-accent" : status === "error" ? "bg-dark-grey" : "bg-mid-grey";
  const label =
    status === "connected"
      ? `Connected · ${toolCount} tool${toolCount === 1 ? "" : "s"}`
      : status === "loading"
      ? "Connecting…"
      : status === "error"
      ? "Connection error"
      : "Not connected";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-medium text-mid-grey hover:text-ink"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {label}
      </button>

      {open && (
        <div className="absolute right-6 mt-2 w-96 max-w-[90vw] rounded-lg border border-line bg-white p-4 z-10">
          <label className="block text-xs font-medium text-dark-grey mb-1">MCP server URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => onServerUrlChange(e.target.value)}
              className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={onReconnect}
              disabled={status === "loading"}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Connect
            </button>
          </div>
          {error && <p className="text-xs text-accent mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
