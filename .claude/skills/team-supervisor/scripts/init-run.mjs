#!/usr/bin/env node
// Create a run: runs/<run-id>/ with role directories, an empty board, the event log and a charter skeleton.
//
//   node init-run.mjs <slug> [--tier T0|T1|T2|T3] [--at YYYYMMDD-HHmm]
//
// Prints the run id on the last line of stdout. Refuses to overwrite an existing run.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RUN_DIRS, RUN_ID, runDir, nowISO, appendEvent, die } from "./lib/team.mjs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const slug = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const tier = opt("--tier") ?? "T1";
if (!slug) die("usage: init-run.mjs <slug> [--tier T0|T1|T2|T3] [--at YYYYMMDD-HHmm]");
if (!/^T[0-3]$/.test(tier)) die(`tier must be T0..T3, got ${tier}`);

const pad = (n) => String(n).padStart(2, "0");
const d = new Date();
const stamp = opt("--at") ?? `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const run = `r-${stamp}-${slug}`;
if (!RUN_ID.test(run)) die(`run id "${run}" is invalid: slug must be 3-40 chars of a-z, 0-9 and "-", starting alphanumeric`);

const dir = runDir(run);
if (existsSync(dir)) die(`run already exists: runs/${run}`);

for (const sub of Object.values(RUN_DIRS)) mkdirSync(join(dir, sub), { recursive: true });
writeFileSync(join(dir, "board.json"), JSON.stringify({ run, revision: 0, updated: nowISO(), tasks: [] }, null, 2) + "\n");
writeFileSync(join(dir, "events.jsonl"), "");
writeFileSync(
  join(dir, "charter.md"),
  `# Charter — ${run}

## Goal

## Acceptance criteria
- C-1:

## Constraints

## Non-goals

## Tier
${tier} — rationale:

## Roles and gates

## Budget

## Assumptions
`
);
appendEvent(run, "supervisor", "RUN", "run_created", `tier ${tier}`);

console.log(`created runs/${run}/ (charter.md, board.json, events.jsonl, ${Object.values(RUN_DIRS).join("/ ")}/)`);
console.log(run);
