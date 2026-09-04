import OpenAI from "openai";

const SYSTEM_PROMPT = `You write a single, self-contained HTML fragment that renders MCP tool output as a
compact, read-only result card inside a chat conversation (like a CRM copilot showing a customer 360
or a lead-created confirmation after a natural-language request).

Rules:
- Output ONLY the HTML fragment — no markdown fences, no prose before or after, and no <!doctype>,
  <html>, <head>, or <body> tags. Just the fragment that goes inside a container element.
- Write the ACTUAL data values directly into the markup as literal text. Do not reference a
  JavaScript variable, do not fetch anything, and do not include a <script> tag unless a specific
  interaction genuinely needs it — most cards need none at all. For a collapsible secondary
  section, use a native <details><summary> element instead of JavaScript.
- Style inline (style="...") or with a single scoped <style> block at the top of the fragment;
  there is no CSS framework available. Base palette: brand magenta #C2185B / dark #880E4F / light
  #F8BBD9, charcoal #212121 (primary text), #424242 (secondary text), #757575 (captions/metadata),
  #F5F5F5 (neutral section fills), #E0E0E0 (borders/dividers), white background. Make the card feel
  designed and colorful, not a plain black-and-white list: give it a colored icon/initial avatar
  (a filled circle with the entity's first letter or a simple glyph), colored status badges/pills
  (a filled rounded chip, not just plain colored text — pick a sensible color per status family:
  greens for active/success/approved, ambers for pending/warning, reds for inactive/failed/blocked,
  greys for neutral/unknown/closed — small color swatches, never large blocks), and a subtle tinted
  background (e.g. a light accent or status tint, not stark white) on the header area or key stat
  tiles. It's fine to introduce a few extra hues this way as long as the overall page still reads
  as one coherent, professional card — magenta stays the dominant/signature color, flat design only
  (no gradients, no box-shadows, no glows), text stays left-aligned and on the neutral greys/
  charcoal above (never pure color body text). Rounded corners around 8-10px on cards/pills.
- Lead with the single most important fact (a name, an id, a status) in a larger/bolder style near
  the top, then supporting details below — this is a quick-glance card, not a dense report. Use a
  short table only for a list of several uniform rows; otherwise a key/value layout or small stat
  tiles. Size everything to fit its content compactly — the card's container auto-sizes to however
  tall you make it, so don't pad it out with empty space, but don't force content into a cramped
  fixed height either.
- Real API responses are often wrapped in an envelope (e.g. a "result" array, or a container named
  after the entity) instead of being the payload itself. Look past that wrapper to the actual
  record before deciding there is nothing to show. Only render the empty/error state when, after
  unwrapping, there is truly no record, or an explicit failure flag says so (isSuccess === false,
  success === false, a non-2xx status, or a populated error message). A field literally named
  "message" that is null is NOT an error — ignore it. Never render the empty/error state just
  because the shape is nested or unfamiliar — read through it first.
- Field names from real backends are often cryptic internal codes (e.g. "acc_ex2_68",
  "parentaccountname"). Prioritize fields with an obvious, recognizable meaning (name, status, id,
  industry, city, dates, amounts) in the main layout, with humanized labels (title case, spaces
  instead of underscores/camelCase). Group anything you cannot confidently label under a
  <details><summary>More details</summary> section rather than omitting it or blocking the card
  on it.
- Escape any data value that might contain HTML-significant characters (<, >, &) so it renders as
  plain text, never as markup.
- Handle empty, null, or error-shaped data (after genuinely checking, per the rule above) with a
  short, friendly message instead of a blank or broken card.`;

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

export async function generateUiHtml({
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
    `Result returned by the tool — read the real values out of this and write them into the HTML:\n${truncateJson(result)}`,
    instructions?.trim()
      ? `Additional instructions from the user about how to present this: ${instructions.trim()}`
      : `No special instructions were given — design the clearest, most appropriate card for this data.`,
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

  if (!code) {
    throw new Error("The model did not return any HTML. Try again or adjust the instructions.");
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
  const fenced = text.match(/```(?:html?|xml)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1] : text;
}
