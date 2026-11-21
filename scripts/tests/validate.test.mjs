// The validator must pass on the real repo and fail on each deliberately broken copy.
//   node --test scripts/tests/

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let root;

const validate = () => {
  const r = spawnSync(process.execPath, [join(root, "scripts", "validate.mjs"), "--quiet"], {
    encoding: "utf8",
    env: { ...process.env, TEAM_ROOT: root },
  });
  return { code: r.status, out: r.stdout + r.stderr };
};
const edit = (rel, fn) => writeFileSync(join(root, rel), fn(readFileSync(join(root, rel), "utf8")));
const SUPERVISOR = ".claude/skills/team-supervisor/SKILL.md";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "team-validate-"));
  for (const p of [".claude", "team", "scripts", "CLAUDE.md"]) cpSync(join(REPO, p), join(root, p), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("passes on an unmodified copy", () => {
  const r = validate();
  assert.equal(r.code, 0, r.out);
});

const broken = [
  ["a reserved word in a skill name", () => edit(SUPERVISOR, (t) => t.replace("name: team-supervisor", "name: claude-supervisor")), /reserved word/],
  ["an uppercase skill name", () => edit(".claude/skills/team-run/SKILL.md", (t) => t.replace("name: team-run", "name: Team_Run")), /must be 1-64 chars/],
  ["a missing description", () => edit(".claude/skills/team-run/SKILL.md", (t) => t.replace(/^description:.*\n/m, "")), /missing description/],
  ["a description over 1024 chars", () => edit(".claude/skills/team-run/SKILL.md", (t) => t.replace(/^description: /m, `description: ${"x".repeat(1100)} `)), /limit 1024/],
  ["CRLF line endings", () => edit(".claude/skills/team-run/SKILL.md", (t) => t.replace(/\n/g, "\r\n")), /CRLF/],
  ["a link to a missing reference file", () => edit(SUPERVISOR, (t) => t + "\nSee [the guide](reference/missing.md).\n"), /links to missing file reference\/missing\.md/],
  ["a reference to a missing script", () => edit(SUPERVISOR, (t) => t + "\nRun `node ${CLAUDE_SKILL_DIR}/scripts/nope.mjs`.\n"), /references missing scripts\/nope\.mjs/],
  ["a script that does not parse", () => writeFileSync(join(root, ".claude/skills/team-supervisor/scripts/broken.mjs"), "export const = ;\n"), /broken\.mjs: does not parse/],
  ["a SKILL.md of 500+ lines", () => edit(".claude/skills/team-run/SKILL.md", (t) => t + "line\n".repeat(500)), /keep SKILL\.md under 500/],
  ["an agent preloading an unknown skill", () => edit(".claude/agents/team-qa.md", (t) => t.replace("\n---\n", "\nskills:\n  - no-such-skill\n---\n")), /preloads unknown skill "no-such-skill"/],
  ["a worker that does not preload the charter", () => edit(".claude/agents/team-planner.md", (t) => t.replace("skills:\n  - team-protocol\n", "")), /does not preload the charter skill "team-protocol"/],
  ["a charter missing a gate", () => edit(".claude/skills/team-protocol/SKILL.md", (t) => t.replaceAll("G4", "G9")), /does not define gate G4/],
  ["a skill folder without SKILL.md", () => mkdirSync(join(root, ".claude/skills/empty-skill")), /empty-skill\/SKILL\.md: missing/],
];

for (const [label, breakIt, expected] of broken) {
  test(`fails on ${label}`, () => {
    breakIt();
    const r = validate();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, expected);
  });
}
