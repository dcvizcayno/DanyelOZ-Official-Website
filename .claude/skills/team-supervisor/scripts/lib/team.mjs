// Shared helpers for the team-supervisor scripts and scripts/validate.mjs. No dependencies.

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Repo root: TEAM_ROOT (tests) > the project this skill is installed in (five levels up, if it carries
// team/manifest.json) > CLAUDE_PROJECT_DIR (skill installed under ~/.claude) > the working directory.
const INSTALLED = resolve(HERE, "..", "..", "..", "..", "..");
export const ROOT = resolve(
  process.env.TEAM_ROOT ||
    (existsSync(join(INSTALLED, "team", "manifest.json")) ? INSTALLED : process.env.CLAUDE_PROJECT_DIR || process.cwd())
);

export const ROLES = ["supervisor", "researcher", "planner", "executor", "qa", "security", "monitor"];
export const RUN_DIRS = { researcher: "research", planner: "plan", executor: "exec", qa: "qa", security: "security", monitor: "monitor" };
export const TASK_STATUSES = ["todo", "doing", "blocked", "review", "done", "dropped"];
export const RUN_ID = /^r-[0-9]{8}-[0-9]{4}-[a-z0-9][a-z0-9-]{2,39}$/;
export const CONTRACTS = join(ROOT, "team", "contracts");

export const runDir = (run) => join(ROOT, "runs", run);
export const readJSON = (path) => JSON.parse(readFileSync(path, "utf8"));
export const nowISO = () => new Date().toISOString();

export function die(msg, code = 2) {
  console.error(`error: ${msg}`);
  process.exit(code);
}

export function requireRun(run) {
  if (!run || !RUN_ID.test(run)) die(`not a run id: ${run ?? "(missing)"}`);
  if (!existsSync(runDir(run))) die(`run not found: runs/${run}`);
  return runDir(run);
}

export function appendEvent(run, from, task, event, summary) {
  const line = JSON.stringify({ ts: nowISO(), from, task, event, summary });
  appendFileSync(join(runDir(run), "events.jsonl"), line + "\n");
}

// ------------------------------------------------------------------ JSON Schema subset

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : typeof v;
}

function resolveRef(ref, root) {
  let node = root;
  for (const part of ref.slice(2).split("/")) node = node?.[part];
  return node;
}

// Supports the keywords the team contracts use: $ref (local and sibling file), allOf, if/then, type,
// const, enum, min/maxLength, pattern, min/maxItems, uniqueItems, items, required, properties,
// additionalProperties:false, minimum.
function check(schema, data, path, errs, root, dir) {
  if (!schema) return;
  if (schema.$ref) {
    if (schema.$ref.startsWith("#/")) {
      const target = resolveRef(schema.$ref, root);
      if (!target) throw new Error(`unresolvable ref ${schema.$ref}`);
      return check(target, data, path, errs, root, dir);
    }
    const sub = readJSON(join(dir, schema.$ref));
    return check(sub, data, path, errs, sub, dir);
  }
  if (schema.allOf) for (const s of schema.allOf) check(s, data, path, errs, root, dir);
  if (schema.if) {
    const probe = [];
    check(schema.if, data, path, probe, root, dir);
    if (probe.length === 0 && schema.then) check(schema.then, data, path, errs, root, dir);
  }
  const t = typeOf(data);
  if (schema.type && schema.type !== t && !(schema.type === "number" && t === "integer")) {
    errs.push(`${path}: expected ${schema.type}, got ${t}`);
    return;
  }
  if ("const" in schema && data !== schema.const) errs.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(data)) errs.push(`${path}: ${JSON.stringify(data)} not allowed`);
  if (typeof data === "number" && schema.minimum != null && data < schema.minimum) errs.push(`${path}: below minimum`);
  if (typeof data === "string") {
    if (schema.minLength != null && data.length < schema.minLength) errs.push(`${path}: too short`);
    if (schema.maxLength != null && data.length > schema.maxLength) errs.push(`${path}: too long`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errs.push(`${path}: does not match ${schema.pattern}`);
  }
  if (Array.isArray(data)) {
    if (schema.minItems != null && data.length < schema.minItems) errs.push(`${path}: too few items`);
    if (schema.maxItems != null && data.length > schema.maxItems) errs.push(`${path}: too many items`);
    if (schema.uniqueItems && new Set(data.map((v) => JSON.stringify(v))).size !== data.length)
      errs.push(`${path}: items not unique`);
    if (schema.items) data.forEach((v, i) => check(schema.items, v, `${path}[${i}]`, errs, root, dir));
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const k of schema.required || []) if (!(k in data)) errs.push(`${path}: missing "${k}"`);
    for (const [k, v] of Object.entries(data)) {
      if (schema.properties?.[k]) check(schema.properties[k], v, `${path}.${k}`, errs, root, dir);
      else if (schema.additionalProperties === false) errs.push(`${path}: unexpected "${k}"`);
    }
  }
}

export function validateAgainst(schemaPath, data) {
  const schema = readJSON(schemaPath);
  const errs = [];
  check(schema, data, "$", errs, schema, dirname(schemaPath));
  return errs;
}

export const validateContract = (name, data) => validateAgainst(join(CONTRACTS, `${name}.schema.json`), data);

// ------------------------------------------------------------------ envelopes

// Accepts a bare JSON envelope or a full agent reply; returns the last JSON object carrying "envelope".
export function extractEnvelope(text) {
  const trimmed = text.trim();
  try {
    const whole = JSON.parse(trimmed);
    if (whole && typeof whole === "object" && "envelope" in whole) return whole;
  } catch {}
  const fenced = [...trimmed.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  for (const block of fenced.reverse()) {
    try {
      const obj = JSON.parse(block);
      if (obj && typeof obj === "object" && "envelope" in obj) return obj;
    } catch {}
  }
  const start = trimmed.lastIndexOf('{"envelope"') >= 0 ? trimmed.lastIndexOf('{"envelope"') : trimmed.lastIndexOf("{\n");
  if (start >= 0) {
    try {
      return JSON.parse(trimmed.slice(start));
    } catch {}
  }
  return null;
}

// ------------------------------------------------------------------ write scopes

// A scope entry is an exact path, a directory ending in "/", or a glob using * and **.
export function scopeMatches(scope, file) {
  const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "");
  const s = norm(scope);
  const f = norm(file);
  if (s.endsWith("/")) return f.startsWith(s);
  if (!s.includes("*")) return f === s || f.startsWith(s + "/");
  const re = s
    .replace(/[.+^${}()|[\]]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*\*/g, "\u0001")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?")
    .replace(/\u0001/g, ".*");
  return new RegExp(`^${re}$`).test(f);
}
