import { NextRequest, NextResponse } from "next/server";
import { generateReactUi } from "@/lib/openai/generateUi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { toolName, toolDescription, args, result, instructions } = body ?? {};

    if (typeof toolName !== "string" || !toolName) {
      return NextResponse.json({ error: "toolName is required" }, { status: 400 });
    }
    if (result === undefined) {
      return NextResponse.json({ error: "result is required" }, { status: 400 });
    }

    const output = await generateReactUi({
      toolName,
      toolDescription: typeof toolDescription === "string" ? toolDescription : undefined,
      args,
      result,
      instructions: typeof instructions === "string" ? instructions : undefined,
    });

    return NextResponse.json(output);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
