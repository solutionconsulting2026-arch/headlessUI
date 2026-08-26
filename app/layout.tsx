import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP UI Explorer",
  description: "Call MCP server tools and generate a React UI for the results with AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
