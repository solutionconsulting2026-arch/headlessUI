import OpenAI from "openai";

const SYSTEM_PROMPT = `You write a single self-contained React component that renders MCP tool output as a
compact result card inside a chat conversation (like a CRM copilot showing a customer 360 or a
lead-created confirmation after a natural-language request).

Rules:
- Output ONLY JavaScript source code, no markdown fences, no prose before or after.
- Define exactly one component: "function App() { ... }".
- Do not use import/export/require statements. React and ReactDOM are already available as
  global variables ("React", "ReactDOM"), and so are all React hooks as globals
  (e.g. "useState", "useEffect", "useMemo").
- The tool's result data is available as a global JavaScript variable called "DATA"
  (already parsed JSON — do not redeclare or JSON.parse it).
- Style with plain inline style objects or a <style> tag you render yourself; there is no CSS
  framework available. Follow this palette strictly: accent magenta #C2185B (used only for the
  card's small header label, key numbers/ids, and icon strokes — never for body text or full
  backgrounds), charcoal #212121 (primary text), #424242 (secondary text), #757575 (captions/
  metadata), #F5F5F5 (subtle section fills), #E0E0E0 (borders/dividers), white background.
  Flat design only: no gradients, no box-shadows, no glows. Left-align all text. Rounded corners
  around 8-10px on cards/pills.
- Lead with the single most important fact (e.g. a name, an id, a status) in a larger/bolder
  style near the top, then supporting details below — this is a quick-glance card, not a dense
  report. Prefer a short table only when DATA is a list of several uniform rows; otherwise use a
  key/value layout or small stat tiles.
- Real API responses are often wrapped in an envelope instead of being the payload itself. Before
  deciding DATA is empty or an error, actively look for and unwrap nesting like
  DATA.result / DATA.data / DATA.results / DATA.records / DATA.account (a container matching the
  entity name) — including one that is itself an array, e.g. DATA.result[0]. Only treat the
  response as empty/error when, after unwrapping, there is truly no record, OR an explicit failure
  flag says so (isSuccess === false, success === false, ok === false, ok === false, a non-2xx
  "status"/"statusCode", or a populated "error"/"message" describing a failure). A field literally
  named "message" that is null is NOT an error — ignore it. Never show the empty/error fallback
  just because the shape is nested or unfamiliar — dig into it first.
- Field names from real backends are often cryptic internal codes (e.g. "acc_ex2_68",
  "parentaccountname", "statuscode"). Prioritize fields with an obvious, recognizable meaning
  (name, status, id, industry, city, dates, amounts) in the main layout; humanize their labels
  (title case, spaces instead of underscores/camelCase). Group any remaining fields you cannot
  confidently label under a clearly-marked secondary section (e.g. "More details") rather than
  omitting them or blocking the whole card on them.
- Handle empty, null, or error-shaped data gracefully with a short, friendly message instead of a
  blank or broken card — but only after genuinely confirming (per the rule above) that there is no
  usable data.
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

  const model = process.env.OPENAI_MODEL || "gpt-4o";
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
