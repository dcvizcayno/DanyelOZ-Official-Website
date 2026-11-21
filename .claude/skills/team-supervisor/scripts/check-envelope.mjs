#!/usr/bin/env node
// Validate one handoff envelope against team/contracts/envelope.schema.json.
//
//   node check-envelope.mjs <file | -> [--run <run-id>]
//
// The input may be a bare JSON envelope or a whole agent reply; the last JSON block carrying
// "envelope" is checked. Exit 0 = valid, 1 = invalid, 2 = usage or input error.

import { readFileSync } from "node:fs";
import { extractEnvelope, validateContract, die } from "./lib/team.mjs";

const args = process.argv.slice(2);
const runAt = args.indexOf("--run");
const run = runAt >= 0 ? args[runAt + 1] : undefined;
const src = args.find((a, i) => runAt < 0 || (i !== runAt && i !== runAt + 1));
if (!src) die("usage: check-envelope.mjs <file | -> [--run <run-id>]");

let text;
try {
  text = readFileSync(src === "-" ? 0 : src, "utf8");
} catch (e) {
  die(`cannot read ${src}: ${e.message}`);
}
const env = extractEnvelope(text);
if (!env) die("no JSON envelope found in input", 1);

const errs = validateContract("envelope", env);
if (run && env.run !== run) errs.push(`$.run: envelope is for ${env.run}, expected ${run}`);

if (errs.length) {
  console.log(`INVALID ${env.id ?? "(no id)"}`);
  for (const e of errs) console.log(`  ${e}`);
  process.exit(1);
}
console.log(`VALID ${env.id}  ${env.from} -> ${env.to}  ${env.kind}/${env.status}${env.verdict ? ` ${env.verdict}` : ""}  ${env.task}`);
