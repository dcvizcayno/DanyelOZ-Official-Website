#!/usr/bin/env node
// The Supervisor's board writer. Every write bumps the revision and appends an event.
//
//   node board.mjs <run-id> show
//   node board.mjs <run-id> import            # tasks from plan/plan.json (validated); skips ids already on the board
//   node board.mjs <run-id> set <T-###> <status> [--note "<why>"]
//
// Statuses: todo doing blocked review done dropped.

import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RUN_DIRS, TASK_STATUSES, requireRun, readJSON, validateContract, appendEvent, nowISO, die } from "./lib/team.mjs";

const [run, cmd, ...rest] = process.argv.slice(2);
const dir = requireRun(run);
const boardPath = join(dir, "board.json");
const board = readJSON(boardPath);

function save(event, task, summary) {
  board.revision += 1;
  board.updated = nowISO();
  writeFileSync(boardPath, JSON.stringify(board, null, 2) + "\n");
  appendEvent(run, "supervisor", task, event, summary);
}

function findCycle(tasks) {
  const deps = new Map(tasks.map((t) => [t.id, t.deps]));
  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === "done") return null;
    if (state.get(id) === "active") return [...trail, id];
    state.set(id, "active");
    for (const d of deps.get(id) || []) {
      const c = visit(d, [...trail, id]);
      if (c) return c;
    }
    state.set(id, "done");
    return null;
  };
  for (const t of tasks) {
    const c = visit(t.id, []);
    if (c) return c;
  }
  return null;
}

if (cmd === "show") {
  console.log(`${board.run}  revision ${board.revision}  updated ${board.updated}`);
  if (!board.tasks.length) console.log("(no tasks)");
  for (const t of board.tasks) {
    const deps = t.deps.length ? `  deps ${t.deps.join(",")}` : "";
    console.log(`${t.id}  ${t.status.padEnd(7)}  ${t.owner.padEnd(10)}  ${t.title}${deps}`);
  }
} else if (cmd === "import") {
  const planPath = join(dir, "plan", "plan.json");
  if (!existsSync(planPath)) die(`no plan at runs/${run}/plan/plan.json`);
  const plan = readJSON(planPath);
  const errs = validateContract("plan", plan);
  if (plan.run !== run) errs.push(`$.run: plan is for ${plan.run}, not ${run}`);
  if (errs.length) die(`plan.json invalid:\n  ${errs.join("\n  ")}`, 1);

  const existing = new Set(board.tasks.map((t) => t.id));
  const incoming = plan.tasks.filter((t) => !existing.has(t.id));
  const skipped = plan.tasks.length - incoming.length;
  const added = incoming.map((t) => ({
    id: t.id,
    owner: t.owner,
    title: t.title,
    status: "todo",
    deps: t.depends_on ?? [],
    write_scope: t.write_scope,
    artifact: t.artifact ?? `runs/${run}/${RUN_DIRS[t.owner] ?? "."}/${t.id}.md`,
  }));
  const all = [...board.tasks, ...added];
  const ids = new Set(all.map((t) => t.id));
  const missing = all.flatMap((t) => t.deps.filter((d) => !ids.has(d)).map((d) => `${t.id} -> ${d}`));
  if (missing.length) die(`unknown dependencies: ${missing.join(", ")}`, 1);
  const cycle = findCycle(all);
  if (cycle) die(`dependency cycle: ${cycle.join(" -> ")}`, 1);
  if (!added.length) die("nothing to import: every plan task is already on the board", 1);

  board.tasks = all;
  save("board_import", "RUN", `${added.length} task(s) from plan.json${skipped ? `, ${skipped} already present` : ""}`);
  console.log(`imported ${added.length} task(s)${skipped ? `, skipped ${skipped} already on the board` : ""}; revision ${board.revision}`);
} else if (cmd === "set") {
  const [id, status] = rest;
  const noteAt = rest.indexOf("--note");
  const note = noteAt >= 0 ? rest[noteAt + 1] : "";
  const task = board.tasks.find((t) => t.id === id);
  if (!task) die(`no task ${id} on the board`);
  if (!TASK_STATUSES.includes(status)) die(`status must be one of ${TASK_STATUSES.join(", ")}`);
  if (status === "doing") {
    const open = task.deps.filter((d) => board.tasks.find((t) => t.id === d)?.status !== "done");
    if (open.length) die(`${id} cannot start: dependencies not done (${open.join(", ")})`, 1);
  }
  const from = task.status;
  task.status = status;
  save("task_status", id, `${from} -> ${status}${note ? `: ${note}` : ""}`);
  console.log(`${id}: ${from} -> ${status}; revision ${board.revision}`);
} else {
  die("usage: board.mjs <run-id> show | import | set <T-###> <status> [--note <why>]");
}
