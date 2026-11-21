#!/usr/bin/env node
// Integrity checks for the agent team and every project skill. No dependencies.
//
//   node scripts/validate.mjs [--quiet]
//
// Roles: each manifest role exists with valid frontmatter and size. Skills: every .claude/skills/*/SKILL.md
// meets the Agent Skills rules (name, description, length), its linked files and scripts exist, and its
// scripts parse. Agents: every preloaded skill exists. Contracts: they parse, and the envelope schema
// accepts a valid handoff and rejects bad ones. Charter: the roles, gates and envelope version appear.
// TEAM_ROOT overrides the repository root (used by the tests).

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, validateAgainst } from "../.claude/skills/team-supervisor/scripts/lib/team.mjs";

const QUIET = process.argv.includes("--quiet");
const failures = [];
const warnings = [];
const fail = (m) => failures.push(m);
const warn = (m) => warnings.push(m);
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, "/");

const manifestPath = join(ROOT, "team", "manifest.json");
if (!existsSync(manifestPath)) {
  console.log("error:   missing team/manifest.json");
  process.exit(1);
}
const MANIFEST = JSON.parse(readFileSync(manifestPath, "utf8"));

// Minimal YAML frontmatter: `key: value` pairs, plus `- item` lists under a key with no inline value.
function parseFrontmatter(text, file) {
  if (text.startsWith("﻿")) return { error: `${file}: starts with a byte-order mark` };
  if (text.includes("\r\n")) return { error: `${file}: has CRLF line endings (use LF; see .gitattributes)` };
  if (!text.startsWith("---\n")) return { error: `${file}: does not start with ---` };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { error: `${file}: unterminated frontmatter` };
  const fields = {};
  let listKey = null;
  for (const line of text.slice(4, end).split("\n")) {
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      fields[listKey].push(item[1].trim());
      continue;
    }
    if (/^\s/.test(line)) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) return { error: `${file}: unparseable frontmatter line: ${line.slice(0, 60)}` };
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    listKey = v === "" ? m[1] : null;
    fields[m[1]] = v === "" ? [] : v;
  }
  return { fields, body: text.slice(end + 4) };
}

function hygiene(path, text) {
  if (/\b(TODO|TBD|FIXME)\b/.test(text)) fail(`${path}: contains a TODO/TBD/FIXME marker`);
  if (text.includes("\t")) fail(`${path}: contains a tab`);
}

// ------------------------------------------------------------------ roles

for (const role of MANIFEST.roles) {
  const file = join(ROOT, role.path);
  if (!existsSync(file)) {
    fail(`${role.id}: missing ${role.path}`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  const fm = parseFrontmatter(text, role.path);
  if (fm.error) {
    fail(fm.error);
    continue;
  }
  const f = fm.fields;
  if (f.name !== `team-${role.id}`) fail(`${role.path}: name is "${f.name}", expected team-${role.id}`);
  if (!f.description) fail(`${role.path}: missing description`);
  else if (f.description.length > MANIFEST.limits.description_max)
    fail(`${role.path}: description is ${f.description.length} chars, limit ${MANIFEST.limits.description_max}`);
  const bytes = statSync(file).size;
  if (bytes > 16000) fail(`${role.path}: ${bytes} bytes is too large for a role definition`);
  if (role.kind === "skill" && bytes > 8192) fail(`${role.path}: ${bytes} bytes exceeds the 8 KB budget for a skill body`);
  hygiene(role.path, text);
  if (fm.body.split("\n").length < 25) warn(`${role.path}: body is only ${fm.body.split("\n").length} lines`);
}

// ------------------------------------------------------------------ skills

const RESERVED = /anthropic|claude/;
const skillsDir = join(ROOT, ".claude", "skills");
const skills = existsSync(skillsDir)
  ? readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
const skillNames = new Set();

for (const dir of skills) {
  const base = join(skillsDir, dir);
  const path = `.claude/skills/${dir}/SKILL.md`;
  if (!existsSync(join(base, "SKILL.md"))) {
    fail(`${path}: missing`);
    continue;
  }
  const text = readFileSync(join(base, "SKILL.md"), "utf8");
  const fm = parseFrontmatter(text, path);
  if (fm.error) {
    fail(fm.error);
    continue;
  }
  const f = fm.fields;
  const name = f.name || dir;
  skillNames.add(name);
  if (!/^[a-z0-9-]{1,64}$/.test(name)) fail(`${path}: name "${name}" must be 1-64 chars of a-z, 0-9 and "-"`);
  if (RESERVED.test(name)) fail(`${path}: name "${name}" contains a reserved word (anthropic, claude)`);
  if (f.name && f.name !== dir) warn(`${path}: name "${f.name}" differs from its directory "${dir}"`);
  if (!f.description) fail(`${path}: missing description`);
  else {
    if (f.description.length > 1024) fail(`${path}: description is ${f.description.length} chars, limit 1024`);
    if (/<[a-z/]/i.test(f.description)) fail(`${path}: description contains an XML-like tag`);
    const listed = f.description.length + (f.when_to_use?.length ?? 0);
    if (listed > 1536) fail(`${path}: description + when_to_use is ${listed} chars; the listing truncates at 1536`);
  }
  const lines = text.split("\n").length;
  if (lines >= 500) fail(`${path}: ${lines} lines; keep SKILL.md under 500 and move detail to reference files`);
  hygiene(path, text);

  for (const [, target] of fm.body.matchAll(/\]\(([^)#\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    if (!existsSync(join(base, target))) fail(`${path}: links to missing file ${target}`);
  }
  for (const [, script] of text.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/(scripts\/[\w./-]+\.\w+)/g)) {
    if (!existsSync(join(base, script))) fail(`${path}: references missing ${script}`);
  }
  const scriptsDir = join(base, "scripts");
  if (existsSync(scriptsDir)) {
    const walk = (d) =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const s of walk(scriptsDir).filter((p) => /\.(m?js)$/.test(p))) {
      const r = spawnSync(process.execPath, ["--check", s], { encoding: "utf8" });
      if (r.status !== 0) fail(`${rel(s)}: does not parse — ${(r.stderr || "").split("\n").find((l) => l.includes("Error")) ?? "syntax error"}`);
    }
  }
}

// ------------------------------------------------------------------ agents

// When the charter is a skill, every worker role must preload it — otherwise workers run without the rules.
const charterSkill = MANIFEST.charter.match(/^\.claude\/skills\/([^/]+)\/SKILL\.md$/)?.[1];
const agentRolePaths = new Set(MANIFEST.roles.filter((r) => r.kind === "agent").map((r) => r.path));
const agentsDir = join(ROOT, ".claude", "agents");
for (const file of existsSync(agentsDir) ? readdirSync(agentsDir).filter((f) => f.endsWith(".md")) : []) {
  const path = `.claude/agents/${file}`;
  const fm = parseFrontmatter(readFileSync(join(agentsDir, file), "utf8"), path);
  if (fm.error) {
    fail(fm.error);
    continue;
  }
  const preload = fm.fields.skills;
  const list = Array.isArray(preload) ? preload : (preload || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const s of list) if (!skillNames.has(s)) fail(`${path}: preloads unknown skill "${s}"`);
  if (charterSkill && agentRolePaths.has(path) && !list.includes(charterSkill))
    fail(`${path}: worker role does not preload the charter skill "${charterSkill}"`);
}

// ------------------------------------------------------------------ contracts

const ENVELOPE_VALID = {
  envelope: "team/v1",
  id: "env-4f2a91c3",
  run: "r-20261114-1015-add-rate-limit",
  from: "qa",
  to: "supervisor",
  kind: "verdict",
  task: "T-005",
  status: "done",
  summary: "All three criteria verified against the running app; no open defects.",
  verdict: "PASS",
  artifacts: ["runs/r-20261114-1015-add-rate-limit/qa/T-005.md"],
  evidence: ["burst 150 -> 100x200 then 50x429: scripts/burst.sh"],
};
const ENVELOPE_INVALID = { ...ENVELOPE_VALID, id: "env-zzz", kind: "done", status: "completed", summary: "done" };
const { verdict: _omit, ...ENVELOPE_NO_VERDICT } = ENVELOPE_VALID;

for (const [name, path] of Object.entries(MANIFEST.contracts)) {
  if (!existsSync(join(ROOT, path))) fail(`contract missing: ${path}`);
  else {
    try {
      const s = JSON.parse(readFileSync(join(ROOT, path), "utf8"));
      if (!s.$id) fail(`${name}: missing $id`);
      if (!s.required?.length) fail(`${name}: no required fields`);
    } catch (e) {
      fail(`${name}: does not parse — ${e.message}`);
    }
  }
}

const envelopeSchema = join(ROOT, MANIFEST.contracts.envelope);
if (existsSync(envelopeSchema)) {
  const okErrs = validateAgainst(envelopeSchema, ENVELOPE_VALID);
  if (okErrs.length) fail(`valid envelope rejected: ${okErrs.join("; ")}`);
  if (!validateAgainst(envelopeSchema, ENVELOPE_INVALID).length) fail("negative fixture accepted — envelope schema is too weak");
  if (!validateAgainst(envelopeSchema, ENVELOPE_NO_VERDICT).length)
    fail("verdict without a verdict field was accepted — conditional rule missing");
}

// ------------------------------------------------------------------ charter

const charterPath = join(ROOT, MANIFEST.charter);
if (!existsSync(charterPath)) fail(`charter missing: ${MANIFEST.charter}`);
else {
  const charter = readFileSync(charterPath, "utf8");
  for (const role of MANIFEST.roles)
    if (!charter.includes(`\`${role.id}\``)) fail(`${MANIFEST.charter}: does not mention role ${role.id}`);
  for (const gate of ["G0", "G1", "G2", "G3", "G4"])
    if (!charter.includes(gate)) fail(`${MANIFEST.charter}: does not define gate ${gate}`);
  if (!charter.includes("team/v1")) fail(`${MANIFEST.charter}: envelope version team/v1 not stated`);
}

// ------------------------------------------------------------------ report

if (!QUIET) {
  console.log(`${MANIFEST.pack} ${MANIFEST.version} — ${MANIFEST.platform}`);
  console.log(`  roles: ${MANIFEST.roles.length} · skills: ${skills.length} · contracts: ${Object.keys(MANIFEST.contracts).length}`);
  console.log("");
}
for (const w of warnings) console.log(`warning: ${w}`);
for (const f of failures) console.log(`error:   ${f}`);
if (failures.length === 0)
  console.log(`PASS — roles, ${skills.length} skills, agent preloads, contracts, envelope accept/reject, charter cross-references`);
else console.log(`FAIL — ${failures.length} error(s)`);
process.exit(failures.length === 0 ? 0 : 1);
