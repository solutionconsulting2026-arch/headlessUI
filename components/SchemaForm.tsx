"use client";

import { useMemo, useState } from "react";

type JsonSchema = Record<string, any>;

interface SchemaFormProps {
  schema: JsonSchema | undefined;
  onSubmit: (values: Record<string, unknown>) => void;
  submitting?: boolean;
  submitLabel?: string;
}

/**
 * Renders a best-effort HTML form from a JSON Schema (the shape MCP tools
 * describe their inputs with). Anything the schema doesn't cleanly map to a
 * simple input (nested objects, arrays of objects, oneOf/anyOf, ...) falls
 * back to a raw JSON textarea for that field, so no valid schema is ever a
 * dead end.
 */
export default function SchemaForm({ schema, onSubmit, submitting, submitLabel = "Call tool" }: SchemaFormProps) {
  const properties: Record<string, JsonSchema> = schema?.properties ?? {};
  const required: string[] = schema?.required ?? [];
  const propertyNames = useMemo(() => Object.keys(properties), [properties]);

  const [values, setValues] = useState<Record<string, unknown>>(() => defaultsFor(properties));
  const [rawFallback, setRawFallback] = useState(false);
  const [rawJson, setRawJson] = useState("{}");
  const [rawError, setRawError] = useState<string | null>(null);

  if (propertyNames.length === 0 && !schema) {
    // No input schema at all — the tool takes no arguments.
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({});
        }}
      >
        <p className="text-sm text-slate-500 mb-3">This tool takes no arguments.</p>
        <SubmitButton submitting={submitting} label={submitLabel} />
      </form>
    );
  }

  if (rawFallback) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const parsed = JSON.parse(rawJson || "{}");
            setRawError(null);
            onSubmit(parsed);
          } catch (err) {
            setRawError((err as Error).message);
          }
        }}
      >
        <label className="block text-sm font-medium text-slate-700 mb-1">Arguments (raw JSON)</label>
        <textarea
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm h-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          spellCheck={false}
        />
        {rawError && <p className="text-sm text-red-600 mt-1">{rawError}</p>}
        <div className="flex items-center gap-3 mt-3">
          <SubmitButton submitting={submitting} label={submitLabel} />
          <button type="button" className="text-sm text-indigo-600 hover:underline" onClick={() => setRawFallback(false)}>
            Use guided form
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="space-y-4">
        {propertyNames.map((name) => (
          <FieldInput
            key={name}
            name={name}
            schema={properties[name]}
            required={required.includes(name)}
            value={values[name]}
            onChange={(v) => setValues((prev) => ({ ...prev, [name]: v }))}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <SubmitButton submitting={submitting} label={submitLabel} />
        <button
          type="button"
          className="text-sm text-indigo-600 hover:underline"
          onClick={() => {
            setRawJson(JSON.stringify(values, null, 2));
            setRawFallback(true);
          }}
        >
          Edit as raw JSON
        </button>
      </div>
    </form>
  );
}

function SubmitButton({ submitting, label }: { submitting?: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {submitting ? "Calling…" : label}
    </button>
  );
}

function defaultsFor(properties: Record<string, JsonSchema>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, s] of Object.entries(properties)) {
    if (s.default !== undefined) out[name] = s.default;
    else if (s.type === "boolean") out[name] = false;
  }
  return out;
}

function isSimpleField(schema: JsonSchema): boolean {
  if (!schema || schema.oneOf || schema.anyOf || schema.allOf) return false;
  const type = schema.type;
  if (["string", "number", "integer", "boolean"].includes(type)) return true;
  if (type === "array" && ["string", "number", "integer"].includes(schema.items?.type)) return true;
  return false;
}

function FieldInput({
  name,
  schema,
  required,
  value,
  onChange,
}: {
  name: string;
  schema: JsonSchema;
  required: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {name}
      {required && <span className="text-red-500"> *</span>}
      {schema?.description && <span className="block text-xs font-normal text-slate-400">{schema.description}</span>}
    </label>
  );

  if (!isSimpleField(schema)) {
    // Nested object / array-of-objects / union schema: edit as JSON.
    const text = typeof value === "string" ? value : JSON.stringify(value ?? (schema?.type === "array" ? [] : {}), null, 2);
    return (
      <div>
        {label}
        <textarea
          className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs h-24 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          defaultValue={text}
          onBlur={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
        />
      </div>
    );
  }

  if (schema.enum) {
    return (
      <div>
        {label}
        <select
          className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {schema.enum.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (schema.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <input
          id={name}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
        />
        <label htmlFor={name} className="text-sm font-medium text-slate-700">
          {name}
          {schema?.description && <span className="block text-xs font-normal text-slate-400">{schema.description}</span>}
        </label>
      </div>
    );
  }

  if (schema.type === "number" || schema.type === "integer") {
    return (
      <div>
        {label}
        <input
          type="number"
          step={schema.type === "integer" ? 1 : "any"}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </div>
    );
  }

  if (schema.type === "array") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div>
        {label}
        <input
          type="text"
          placeholder="comma-separated values"
          className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          defaultValue={arr.join(", ")}
          onBlur={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (schema.items?.type === "number" || schema.items?.type === "integer" ? Number(s) : s))
            )
          }
        />
      </div>
    );
  }

  // string (default)
  return (
    <div>
      {label}
      <input
        type="text"
        className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
