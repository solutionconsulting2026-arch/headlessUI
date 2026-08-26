"use client";

import { useMemo } from "react";

interface GeneratedUiFrameProps {
  code: string;
}

/**
 * Renders an AI-generated HTML fragment in a sandboxed iframe. The iframe has
 * "allow-scripts" only (no "allow-same-origin"), so it executes in a unique,
 * opaque origin: it cannot read this page's DOM/cookies/localStorage, submit
 * top-level navigations, or otherwise touch the parent app, no matter what
 * the generated markup does. The fragment is plain HTML with the real data
 * values already baked in — no framework or CDN scripts are loaded, so it
 * renders instantly and has no external dependency.
 */
export default function GeneratedUiFrame({ code }: GeneratedUiFrameProps) {
  const srcDoc = useMemo(() => buildHtmlDocument(code), [code]);

  return (
    <iframe
      title="Generated result card"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="w-full bg-white"
      style={{ height: "min(60vh, 520px)" }}
    />
  );
}

function buildHtmlDocument(fragment: string): string {
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
    font-family: Calibri, "Segoe UI", Arial, "Helvetica Neue", sans-serif;
    color: #212121;
    background: #ffffff;
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
</head>
<body>
<div id="error-banner"></div>
${fragment}
<script>
  window.onerror = function (message) {
    var el = document.getElementById("error-banner");
    el.style.display = "block";
    el.textContent = "Error rendering this card: " + message;
  };
</script>
</body>
</html>`;
}
