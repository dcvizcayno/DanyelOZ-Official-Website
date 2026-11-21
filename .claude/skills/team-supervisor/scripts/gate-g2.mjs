#!/usr/bin/env node
// G2 task review: the mechanical half of the gate. The Supervisor still reads the artifact and judges it.
//
//   node gate-g2.mjs <run-id> <envelope-file> [--accept]
//
// Checks: envelope schema; run id; task on the board and owned by the sender; envelope id unused in
// this run; claimed artifacts exist; run artifacts sit in the sender's directory; product files claimed
// or changed fall inside an active task's write scope; "done" carries an artifact or evidence.
// --accept records a passing envelope in runs/<run>/envelopes.jsonl (the uniqueness ledger).
// Exit 0 = pass, 1 = fail, 2 = usage error.

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, RUN_DIRS, requireRun, readJSON, extractEnvelope, validateContract, scopeMatches, appendEvent, die } from "./lib/team.mjs";

const args = process.argv.slice(2);
const accept = args.includes("--accept");
const [run, file] = args.filter((a) => a !== "--accept");
const dir = requireRun(run);
if (!file) die("usage: gate-g2.mjs <run-id> <envelope-file> [--accept]");

const failures = [];
const warnings = [];
const env = extractEnvelope(readFileSync(file, "utf8"));
if (!env) die("no JSON envelope found in input", 1);

failures.push(...validateContract("envelope", env).map((e) => `schema ${e}`));
if (env.run !== run) failures.push(`envelope is for run ${env.run}, not ${run}`);

const board = readJSON(join(dir, "board.json"));
const task = board.tasks.find((t) => t.id === env.task);
if (env.task !== "RUN") {
  if (!task) failures.push(`task ${env.task} is not on the board`);
  else if (task.owner !== env.from) failures.push(`task ${env.task} belongs to ${task.owner}, envelope is from ${env.from}`);
}

const ledgerPath = join(dir, "envelopes.jsonl");
const seen = existsSync(ledgerPath)
  ? readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id)
  : [];
if (seen.includes(env.id)) failures.push(`envelope id ${env.id} already used in this run`);

const active = board.tasks.filter((t) => ["doing", "review"].includes(t.status) || t.id === env.task);
const inScope = (f) => active.some((t) => t.write_scope.some((s) => scopeMatches(s, f)));
const runPrefix = `runs/${run}/`;
const ownDir = RUN_DIRS[env.from] ? `${runPrefix}${RUN_DIRS[env.from]}/` : runPrefix;

for (const a of env.artifacts ?? []) {
  const rel = a.replace(/\\/g, "/");
  if (!existsSync(join(ROOT, rel))) failures.push(`artifact missing: ${rel}`);
  if (rel.startsWith(runPrefix)) {
    if (!rel.startsWith(ownDir)) failures.push(`artifact ${rel} is outside ${env.from}'s directory ${ownDir}`);
  } else if (!inScope(rel)) failures.push(`artifact ${rel} is outside every active write scope`);
}
if (env.status === "done" && !(env.artifacts?.length || env.evidence?.length))
  failures.push(`status "done" with no artifacts and no evidence`);

try {
  const out = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: ROOT, encoding: "utf8" });
  const changed = out
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, "").split(" -> ").pop())
    .filter((f) => !f.startsWith("runs/"));
  const stray = changed.filter((f) => !inScope(f));
  if (stray.length) failures.push(`changed files outside every active write scope: ${stray.join(", ")}`);
} catch {
  warnings.push("git unavailable: write-scope check on the working tree skipped");
}

for (const w of warnings) console.log(`warning: ${w}`);
if (failures.length) {
  console.log(`G2 FAIL ${env.id ?? ""} (${env.task ?? "?"})`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`G2 PASS ${env.id} (${env.task}, ${env.from}, ${env.status})`);
if (accept) {
  appendFileSync(ledgerPath, JSON.stringify(env) + "\n");
  appendEvent(run, "supervisor", env.task, "g2_pass", `${env.id} from ${env.from}`);
  console.log(`recorded in runs/${run}/envelopes.jsonl`);
}
