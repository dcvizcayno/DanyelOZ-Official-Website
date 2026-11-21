---
name: team-protocol
description: The agent team's shared charter - roster, risk tiers, run layout, handoff envelope, task board, gates G0-G4, escalation, non-negotiables and budgets. Use when acting as any team-* role, supervising a team run, or reading or writing anything under runs/.
user-invocable: false
---

# Team protocol

A seven-role agent team: a Supervisor coordinating a Researcher, Planner, Executor, QA, Security
Architect, and Monitor. The Supervisor runs in the main session through the `team-supervisor` skill;
every other role is a `team-*` subagent in `.claude/agents/` that preloads this skill. Your role file or
skill says who you are; this protocol is shared by all of them and does not assign an identity.

## 1. Roster

| id | Owns | Must never |
|---|---|---|
| `supervisor` | intake, charter, tier, waves, gates, aggregation, human comms | write product code, certify QA or security |
| `researcher` | decision-grade facts, sources, options | produce the plan, edit product files |
| `planner` | decomposition, dependencies, acceptance tests, rollback | implement, self-approve its plan |
| `executor` | implement exactly one assigned task, with receipts | widen scope, disable checks, self-certify |
| `qa` | independent verification, verdicts, reproducible defects | fix the code, audit its own work |
| `security` | threat model, risk register, gate veto | exploit live systems, print secrets |
| `monitor` | baselines, checkpoints, drift and budget signals | block on opinion without a threshold |

Collaboration is through artifacts and the board, not side conversations: the researcher's brief feeds
the planner, the plan is the executor's contract, the diff is QA's subject, and every verdict returns to
the Supervisor. No role edits another role's artifact.

## 2. Risk tiers

Tier sets process weight, not effort. Choose the **lowest** tier that covers the risk.

| Tier | Signals | Mandatory roles | Gates |
|---|---|---|---|
| `T0` | read-only answer, no writes | supervisor (+ researcher) | none — answer directly |
| `T1` | scoped, reversible change; no auth, secrets, PII, deps, prod config | supervisor, researcher, planner, executor, qa | G1, G3 |
| `T2` | auth/authz, secrets, PII, money, migrations, new dependencies, public API | all seven | G0 for irreversible steps, G1–G4 |
| `T3` | irreversible, prod data, safety, wide blast radius | all seven + human approval | G0 before work, G4 before release |

Ambiguous between two tiers: take the higher one and say why in the charter.

## 3. Run layout

Run id: `r-YYYYMMDD-HHmm-<slug>`.

```
runs/<run-id>/
  charter.md            # supervisor only
  board.json            # supervisor only
  events.jsonl          # append-only, any role
  envelopes.jsonl       # supervisor only: envelopes accepted at G2 (id-uniqueness ledger)
  research/ plan/ security/ exec/ qa/ monitor/    # each role owns its directory
  report.md             # supervisor only
```

- **One writer per file.** A role writes only inside its own directory.
- **Artifacts over prose.** Detail goes to files; the reply stays short.
- **Events are append-only**: `{"ts","from","task","event","summary"}` per line, never rewritten.

## 4. Envelope — every handoff

Every role ends its final message with exactly one JSON block, nothing after it:

```json
{
  "envelope": "team/v1",
  "id": "env-4f2a91c3",
  "run": "r-20261114-1015-add-rate-limit",
  "from": "researcher",
  "to": "supervisor",
  "kind": "report",
  "task": "T-002",
  "status": "done",
  "summary": "Token bucket over the existing Redis client is the lowest-risk option.",
  "confidence": "high",
  "artifacts": ["runs/r-20261114-1015-add-rate-limit/research/T-002.md"],
  "evidence": ["redis client: src/cache/redis.ts:14"],
  "open_questions": ["per-IP or per-key limit?"],
  "next": "planner can decompose against the middleware"
}
```

Required: `envelope`, `id` (`env-` + 8 hex), `run`, `from`, `to`, `kind`, `task` (`T-###` or `RUN`),
`status`, `summary` (≤ 280 chars). `kind` ∈ `assignment|report|question|blocker|verdict|status|handoff|ack`;
`status` ∈ `done|partial|blocked|failed|n/a`; verdicts add `verdict` ∈ `PASS|PASS_WITH_CONDITIONS|FAIL|BLOCKED`.
Full contract: `team/contracts/envelope.schema.json`.

No schema expresses artifact existence, envelope-id uniqueness or write-scope compliance; the Supervisor's
`gate-g2.mjs` checks them at G2, so a claimed artifact that is not on disk fails the gate.

## 5. Task board

`board.json`: `{"run", "revision", "updated", "tasks":[{id, owner, title, status, deps, write_scope, artifact}]}`
with statuses `todo|doing|blocked|review|done|dropped`. Only the Supervisor writes it, through `board.mjs`. Workers report in
their envelope; the Supervisor reconciles. Never claim or close a task you were not given.

## 6. Gates

| Gate | Owner | Passes when |
|---|---|---|
| `G0` charter | supervisor (+ human at T3) | goal, criteria, constraints, tier, non-goals written and accepted |
| `G1` plan | supervisor | every criterion maps to tasks and verification; every task has a testable definition of done and write scope; T2+ has a security design review |
| `G2` task review | supervisor | artifact exists, receipts present, deviations declared, write scope respected |
| `G3` QA | qa | every criterion has executed evidence; no open S1/S2 |
| `G4` release | supervisor + security (T2+) | QA pass or accepted conditions, monitor green, no open Critical/High |

A gate is passed only by its owner. The executor cannot certify QA; the planner cannot approve security;
the Supervisor cannot waive a security veto at T2+ without a human decision.

## 7. Escalation

Self-resolve within scope (log it) → Supervisor (blocker envelope) → human (scope, tier, irreversibility,
conflicting criteria). Escalate after two failed attempts on one symptom, at 70% of budget, or the moment
a task needs writes outside its scope. A blocker states what you tried, what you need, the options, and a
recommendation. "Blocked" without a question is a defect.

## 8. Non-negotiables

1. Evidence over assertion — every "done" carries a command and outcome, a path, or a citation.
2. No silent scope expansion — new work becomes a new task or an escalation.
3. Respect write scopes; anything else needs approval first.
4. Never weaken a check to make it pass.
5. No secret is printed, copied into artifacts, or committed; redact and escalate.
6. Irreversible actions need explicit approval at T2+.
7. Do not certify your own work, and never accept another role's claim as evidence.
8. Bounded output — short reply plus the envelope; detail in the artifact.
9. Write your artifact by 70% of budget; a partial artifact with stated gaps beats a perfect review that
   never lands.
10. Leave no residue: no debug prints, temp files, TODOs, or commented-out code.

## 9. Budgets

One wave ≤ 4 concurrent teammates · default task budget 20 minutes / 25 tool calls · stop-loss at 2× the
estimate · report `cost` in the envelope when known.

## 10. File map

| Path | Purpose |
|---|---|
| `.claude/skills/team-protocol/` | this charter |
| `.claude/skills/team-supervisor/` | Supervisor method and its scripts (`init-run`, `board`, `check-envelope`, `gate-g2`) |
| `.claude/skills/team-run/` | `/team-run` entry point |
| `.claude/agents/` | the six worker role definitions |
| `team/contracts/` | envelope, task, plan schemas |
| `team/manifest.json` | roster and contract paths the validator reads |
| `scripts/validate.mjs`, `scripts/tests/` | integrity checks and their tests |
| `runs/` | per-run records |
