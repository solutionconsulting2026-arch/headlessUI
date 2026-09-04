"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface GeneratedUiFrameProps {
  code: string;
}

const RESIZE_MESSAGE_TYPE = "mcp-ui-explorer:resize";
const MIN_HEIGHT = 72;
const MAX_HEIGHT = 720;

/**
 * Renders an AI-generated HTML fragment in a sandboxed iframe. The iframe has
 * "allow-scripts" only (no "allow-same-origin"), so it executes in a unique,
 * opaque origin: it cannot read this page's DOM/cookies/localStorage, submit
 * top-level navigations, or otherwise touch the parent app, no matter what
 * the generated markup does. The fragment is plain HTML with the real data
 * values already baked in — no framework or CDN scripts are loaded, so it
 * renders instantly and has no external dependency.
 *
 * The iframe auto-sizes to its content (rather than scrolling inside a fixed
 * box) via postMessage: the harness script below — not the model — measures
 * the document height inside the sandbox and reports it to the parent. Direct
 * DOM access from the parent isn't possible here (that's exactly what the
 * missing "allow-same-origin" blocks), so postMessage is the correct
 * cross-origin-safe channel for this.
 */
export default function GeneratedUiFrame({ code }: GeneratedUiFrameProps) {
  const srcDoc = useMemo(() => buildHtmlDocument(code), [code]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);

  useEffect(() => {
    setHeight(MIN_HEIGHT);

    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || event.data.type !== RESIZE_MESSAGE_TYPE) return;
      const reported = Number(event.data.height);
      if (!Number.isFinite(reported)) return;
      setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(reported) + 2)));
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title="Generated result card"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="w-full bg-white block"
      style={{ height, transition: "height 150ms ease" }}
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
  html, body {
    margin: 0;
    padding: 0;
  }
  body {
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

  (function () {
    var lastReported = 0;
    function reportHeight() {
      var h = document.documentElement.scrollHeight;
      if (h === lastReported) return;
      lastReported = h;
      parent.postMessage({ type: "${RESIZE_MESSAGE_TYPE}", height: h }, "*");
    }
    window.addEventListener("load", reportHeight);
    if (window.ResizeObserver) {
      new ResizeObserver(reportHeight).observe(document.body);
    } else {
      window.setInterval(reportHeight, 400);
    }
    reportHeight();
  })();
</script>
</body>
</html>`;
}
