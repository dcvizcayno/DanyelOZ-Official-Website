// End-to-end tests for .claude/skills/team-supervisor/scripts against a throwaway repo.
//   node --test scripts/tests/

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS = join(REPO, ".claude", "skills", "team-supervisor", "scripts");
const RUN = "r-20261115-1200-demo-run";
let root; // the throwaway repo the scripts operate on
let scratch; // envelope fixtures live outside the repo so they never count as changed files

const sh = (script, ...args) => {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TEAM_ROOT: root },
  });
  return { code: r.status, out: r.stdout + r.stderr };
};
const put = (base, rel, data) => {
  mkdirSync(dirname(join(base, rel)), { recursive: true });
  writeFileSync(join(base, rel), typeof data === "string" ? data : JSON.stringify(data, null, 2));
  return join(base, rel);
};
const write = (rel, data) => put(root, rel, data);
const fixture = (name, data) => put(scratch, name, data);
const runFile = (rel) => readFileSync(join(root, "runs", RUN, rel), "utf8");

const envelope = (over = {}) => ({
  envelope: "team/v1",
  id: "env-0000000a",
  run: RUN,
  from: "executor",
  to: "supervisor",
  kind: "report",
  task: "T-001",
  status: "done",
  summary: "Implemented the flag and ran its test.",
  artifacts: [`runs/${RUN}/exec/T-001.md`],
  evidence: ["node --test -> 3 passed"],
  ...over,
});
const task = (id, over = {}) => ({
  id,
  owner: "executor",
  title: `Implement piece ${id}`,
  definition_of_done: ["the command prints the expected output"],
  write_scope: ["src/feature/"],
  verify: ["run node src/feature/cli.mjs and compare"],
  ...over,
});
const plan = (tasks) => ({
  run: RUN,
  goal: "Add a feature flag to the CLI",
  criteria: [{ id: "C-1", text: "flag prints json output", verify: "run the cli with the flag" }],
  tasks,
  open_questions: [],
});

before(() => {
  root = mkdtempSync(join(tmpdir(), "team-scripts-"));
  scratch = mkdtempSync(join(tmpdir(), "team-fixtures-"));
  cpSync(join(REPO, "team", "contracts"), join(root, "team", "contracts"), { recursive: true });
  const git = (...a) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: root });
  git("init", "-q");
  git("add", ".");
  git("commit", "-qm", "fixture");
});
after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
});

test("init-run creates the run layout and refuses a duplicate", () => {
  const r = sh("init-run.mjs", "demo-run", "--at", "20261115-1200", "--tier", "T1");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, new RegExp(`${RUN}\\s*$`));
  const board = JSON.parse(runFile("board.json"));
  assert.deepEqual([board.run, board.revision, board.tasks.length], [RUN, 0, 0]);
  for (const f of ["charter.md", "research", "plan", "exec", "qa", "security", "monitor"])
    assert.ok(existsSync(join(root, "runs", RUN, f)), `missing ${f}`);
  assert.match(runFile("events.jsonl"), /"run_created"/);
  assert.equal(sh("init-run.mjs", "demo-run", "--at", "20261115-1200").code, 2);
});

test("init-run rejects a bad slug and a bad tier", () => {
  assert.equal(sh("init-run.mjs", "Bad_Slug").code, 2);
  assert.equal(sh("init-run.mjs", "ok-slug", "--tier", "T9").code, 2);
});

test("check-envelope accepts a valid envelope inside an agent reply", () => {
  const f = fixture("reply.md", "Done.\n\n```json\n" + JSON.stringify(envelope(), null, 2) + "\n```\n");
  const r = sh("check-envelope.mjs", f, "--run", RUN);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^VALID env-0000000a/);
});

test("check-envelope rejects a bad id, a verdict without verdict, a wrong run and no envelope", () => {
  assert.equal(sh("check-envelope.mjs", fixture("bad.json", envelope({ id: "env-xyz" }))).code, 1);
  assert.match(sh("check-envelope.mjs", fixture("nov.json", envelope({ kind: "verdict", from: "qa" }))).out, /missing "verdict"/);
  assert.equal(sh("check-envelope.mjs", fixture("good.json", envelope()), "--run", "r-20261115-1200-other-run").code, 1);
  assert.equal(sh("check-envelope.mjs", fixture("none.txt", "no envelope here")).code, 1);
});

test("board import rejects a cycle, then imports a valid plan once", () => {
  write(`runs/${RUN}/plan/plan.json`, plan([task("T-001", { depends_on: ["T-002"] }), task("T-002", { depends_on: ["T-001"] })]));
  assert.match(sh("board.mjs", RUN, "import").out, /dependency cycle/);
  write(`runs/${RUN}/plan/plan.json`, plan([task("T-001"), task("T-002", { depends_on: ["T-001"], owner: "qa", write_scope: [] })]));
  const r = sh("board.mjs", RUN, "import");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /imported 2 task/);
  assert.equal(sh("board.mjs", RUN, "import").code, 1);
});

test("board set enforces dependencies and statuses, and bumps the revision", () => {
  assert.match(sh("board.mjs", RUN, "set", "T-002", "doing").out, /dependencies not done/);
  assert.equal(sh("board.mjs", RUN, "set", "T-001", "doing").code, 0);
  assert.equal(sh("board.mjs", RUN, "set", "T-001", "finished").code, 2);
  assert.equal(JSON.parse(runFile("board.json")).revision, 2);
  assert.match(sh("board.mjs", RUN, "show").out, /T-001\s+doing/);
});

test("gate-g2 fails on a missing artifact, the wrong owner, and out-of-scope changes", () => {
  const env = fixture("env.json", envelope());
  assert.match(sh("gate-g2.mjs", RUN, env).out, /artifact missing/);
  const wrong = fixture("owner.json", envelope({ from: "researcher", artifacts: [], evidence: ["x: y"] }));
  assert.match(sh("gate-g2.mjs", RUN, wrong).out, /belongs to executor/);
  write(`runs/${RUN}/exec/T-001.md`, "receipts");
  write("src/other/leak.mjs", "export {}");
  const r = sh("gate-g2.mjs", RUN, env);
  assert.equal(r.code, 1);
  assert.match(r.out, /outside every active write scope: src\/other\/leak\.mjs$/m);
  rmSync(join(root, "src", "other"), { recursive: true });
});

test("gate-g2 passes in scope, records the envelope, and rejects its id on reuse", () => {
  write("src/feature/cli.mjs", "export {}");
  const env = join(scratch, "env.json");
  const ok = sh("gate-g2.mjs", RUN, env, "--accept");
  assert.equal(ok.code, 0, ok.out);
  assert.match(runFile("envelopes.jsonl"), /env-0000000a/);
  assert.match(runFile("events.jsonl"), /"g2_pass"/);
  assert.match(sh("gate-g2.mjs", RUN, env).out, /already used in this run/);
});
