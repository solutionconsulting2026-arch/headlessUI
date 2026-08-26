"use client";

import { useMemo } from "react";

interface GeneratedUiFrameProps {
  code: string;
  data: unknown;
}

/**
 * Renders AI-generated React code in a sandboxed iframe. The iframe has
 * "allow-scripts" only (no "allow-same-origin"), so it executes in a unique,
 * opaque origin: it cannot read this page's DOM/cookies/localStorage, submit
 * top-level navigations, or otherwise touch the parent app, no matter what
 * the generated code does. React/ReactDOM/Babel are loaded from a CDN inside
 * that isolated frame purely to transpile and run the generated JSX.
 */
export default function GeneratedUiFrame({ code, data }: GeneratedUiFrameProps) {
  const srcDoc = useMemo(() => buildHtmlDocument(code, data), [code, data]);

  return (
    <iframe
      title="AI-generated UI"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="w-full rounded-lg border border-slate-200 bg-white"
      style={{ height: "70vh" }}
    />
  );
}

function buildHtmlDocument(code: string, data: unknown): string {
  const dataJson = JSON.stringify(data ?? null).replace(/</g, "\\u003c");
  const escapedCode = code.replace(/<\/script>/gi, "<\\/script>");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    color: #0f172a;
    background: #ffffff;
  }
  #root:empty::after {
    content: "Rendering…";
    color: #94a3b8;
    font-size: 14px;
  }
  #error-banner {
    display: none;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    white-space: pre-wrap;
    margin-bottom: 12px;
  }
</style>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
</head>
<body>
<div id="error-banner"></div>
<div id="root"></div>
<script id="mcp-data" type="application/json">${dataJson}</script>
<script>
  window.onerror = function (message) {
    var el = document.getElementById("error-banner");
    el.style.display = "block";
    el.textContent = "Error rendering generated UI: " + message;
  };
</script>
<script type="text/babel" data-presets="react">
  const DATA = JSON.parse(document.getElementById("mcp-data").textContent);
  const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

  ${escapedCode}

  try {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(React.createElement(App));
  } catch (err) {
    const el = document.getElementById("error-banner");
    el.style.display = "block";
    el.textContent = "Error rendering generated UI: " + (err && err.message ? err.message : String(err));
  }
</script>
</body>
</html>`;
}
