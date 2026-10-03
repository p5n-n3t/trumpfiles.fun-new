# Worker 17 account5 citation190 release-gate audit

Input packet: `codex/citation190-crossqa-2026-10-03` at `9ea34e84716e0599d8c63e0bb0714f64f545df25`. All 12 input hashes match the manifest, and the latest account5 branch outputs reconcile to exactly 190 unique assigned keys. The 12 inspected account5 branch heads and their input hashes are recorded in the checkpoint.

Effective gate outcomes: **97 accepted narrower claims**, **58 revision required**, **10 hold**, **25 intentional exclusions**. Accepted is reserved for supported/pass dispositions with `release_ready=true`; supported proposals with `release_ready=false` remain blocked. An exclusion marked ready is only a ready exclusion decision, not publication approval.

Cross-check against worker 17 source270 QA: **0 overlapping keys** (source270 set contained 270 unique keys).

Exact URL review: 4 rows contain a verified URL that is absent from the explicit fact map: `entry-2518` and `entry-2864` are exclusions (their worker notes explain the unrelied-on or mismatched sources); `entry-2401` is an exclusion; `entry-1782` remains revision-required because its saved proposal text is incomplete. These rows remain non-passing as categorized. `entry-5597` has an AP mapped URL with a different canonical URL string but the same article identifier as its verified URL; its AP indexed-text/HTTP 403 limitation is preserved.

The normalized proposal, reasons, exact URLs, fact mappings, URL dispositions, per-worker input hash, branch head, and worker source-file references are preserved in the effective row for every key. Raw worker dispositions remain alongside the independent gate outcome.

No canonical records, Neon data, other worker outputs, or pull requests were changed. The work is an integration QA of published evidence, not a new source-research pass.

| Worker | Assigned | Normalized | Account5 branch head | Gate results |
|---:|---:|---:|---|---|
| 1 | 16 | 16 | `1a94e2256de5` | accepted 8, revise 6, hold 1, exclude 1 |
| 2 | 16 | 16 | `c5bf875c052a` | accepted 10, revise 4, hold 1, exclude 1 |
| 3 | 16 | 16 | `e06c4cc47222` | accepted 6, revise 7, hold 2, exclude 1 |
| 4 | 16 | 16 | `983f465b5d59` | accepted 9, revise 5, hold 0, exclude 2 |
| 5 | 16 | 16 | `4cd949b2be9b` | accepted 9, revise 1, hold 2, exclude 4 |
| 6 | 16 | 16 | `00dcebbb523a` | accepted 11, revise 2, hold 0, exclude 3 |
| 7 | 16 | 16 | `638eabe51634` | accepted 10, revise 1, hold 1, exclude 4 |
| 8 | 16 | 16 | `e46548eb9e18` | accepted 2, revise 12, hold 0, exclude 2 |
| 9 | 16 | 16 | `a887bcb4d6ea` | accepted 8, revise 6, hold 1, exclude 1 |
| 10 | 16 | 16 | `59186011281f` | accepted 5, revise 7, hold 1, exclude 3 |
| 11 | 15 | 15 | `acfa096935de` | accepted 10, revise 3, hold 1, exclude 1 |
| 12 | 15 | 15 | `03282adfe631` | accepted 9, revise 4, hold 0, exclude 2 |

Artifacts:

- `data/neon-workbench/external/account2-release-round-2026-10-04/worker-17/worker-17-account5-citation190-effective-001.jsonl` — one effective gate row per exact key.
- `data/neon-workbench/external/account2-release-round-2026-10-04/worker-17/worker-17-checkpoint-001.json` — branch/input commits and current checkpoint.
- `data/neon-workbench/external/account2-release-round-2026-10-04/worker-17/worker-17-independent-qa.json` — exact-set validation, gate counts, overlap and URL-mapping exceptions.
