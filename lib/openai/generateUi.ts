import OpenAI from "openai";

const SYSTEM_PROMPT = `You write a single self-contained React component that renders MCP tool output.

Rules:
- Output ONLY JavaScript source code, no markdown fences, no prose before or after.
- Define exactly one component: "function App() { ... }".
- Do not use import/export/require statements. React and ReactDOM are already available as
  global variables ("React", "ReactDOM"), and so are all React hooks as globals
  (e.g. "useState", "useEffect", "useMemo").
- The tool's result data is available as a global JavaScript variable called "DATA"
  (already parsed JSON — do not redeclare or JSON.parse it).
- Style with plain inline style objects or a <style> tag you render yourself; there is no
  CSS framework available. Keep the look clean, modern, and readable (good spacing,
  a clear type scale, subtle borders/shadows, a light color palette).
- Choose the presentation that best fits the shape of DATA: a table for lists of uniform
  objects, cards/stats for summaries, a simple bar/line chart (hand-drawn with SVG or divs;
  do not assume any charting library is available) for numeric series, key/value panels for
  nested objects, etc.
- Handle empty, null, or error-shaped data gracefully with a friendly message.
- Never fetch network resources and never use dangerouslySetInnerHTML.
- The component takes no props and must render without throwing.`;

export interface GenerateUiParams {
  toolName: string;
  toolDescription?: string;
  args: unknown;
  result: unknown;
  instructions?: string;
}

export interface GenerateUiOutput {
  code: string;
  model: string;
}

export async function generateReactUi({
  toolName,
  toolDescription,
  args,
  result,
  instructions,
}: GenerateUiParams): Promise<GenerateUiOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set on the server. Add it to .env.local and restart the app.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const userPrompt = [
    `MCP tool called: ${toolName}`,
    toolDescription ? `Tool description: ${toolDescription}` : undefined,
    `Arguments passed to the tool:\n${truncateJson(args)}`,
    `Result returned by the tool (this is exactly what DATA will contain at runtime):\n${truncateJson(result)}`,
    instructions?.trim()
      ? `Additional instructions from the user about how to present this: ${instructions.trim()}`
      : `No special instructions were given — design the clearest, most appropriate UI for this data.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const code = stripCodeFences(raw).trim();

  if (!code || !/function\s+App\s*\(/.test(code)) {
    throw new Error("The model did not return a valid App() component. Try again or adjust the instructions.");
  }

  return { code, model };
}

function truncateJson(value: unknown, maxChars = 12000): string {
  let json: string;
  try {
    json = JSON.stringify(value, null, 2) ?? "null";
  } catch {
    json = String(value);
  }
  if (json.length > maxChars) {
    return `${json.slice(0, maxChars)}\n... (truncated, ${json.length - maxChars} more characters)`;
  }
  return json;
}

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:jsx?|tsx?|javascript)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1] : text;
}
