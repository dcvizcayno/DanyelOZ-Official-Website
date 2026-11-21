# Failures and conflicting reports

Read this when a worker blocks, errors, or fails G2; when the run hits its stop-loss; or when two roles'
reports disagree.

## Handling failure

| Symptom | Response |
|---|---|
| Worker returns `blocked` with a question | Answer it if the charter covers it; otherwise escalate. Re-delegate with the answer as context. |
| Worker errors or dies | Retry **once** with the failure output included; then reassign or escalate. |
| Artifact missing or claim unverified | G2 reject with the exact defect list (`gate-g2.mjs` output plus your own findings); at most two cycles, then do it yourself or escalate. |
| Scope creep discovered mid-run | New task, re-tier if needed, and disclose it in the report. |
| Budget at 70% with under half the tasks done | Stop-loss: cut scope with the user's agreement, or extend explicitly. |

Record each response on the board with `board.mjs <run> set <T-###> <status> --note "<why>"` so the event
log carries the decision.

## Aggregating conflicting reports

Authority is claim-specific, not hierarchical:

- QA > executor on "does it work".
- Security > everyone on "is it safe".
- Researcher > planner on "what is true".
- Planner > supervisor on sequencing.

Never average a conflict — settle it with evidence, or record both positions and escalate. Every resolved
conflict goes into the report's decision log.
