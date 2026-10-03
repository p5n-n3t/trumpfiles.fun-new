# Worker 17 source270 coordinator QA

Assignment packet: `origin/codex/source-rescue-unassigned-2026-10-03` at `19831e87e22fd5890fe0a764be51c617580d4a99`. Manifest claims 270 unique records across workers 4–12; all nine input SHA256 values matched the manifest and each packet contained 30 rows.

Final exact-set validation: **PASS** — 270 rows, 270 unique keys, no missing, extra, or duplicate IDs. Latest published outputs yield 240 terminal proposals and 30 pending records. Terminal proposal statuses: accepted_source=29, exclusion_candidate=4, needs_correction=207.

Pending IDs (worker 5 has no published source-rescue batch on its latest branch): entry-4231, entry-4398, entry-4446, entry-4781, entry-5104, entry-5316, entry-5522, entry-5729, entry-5748, entry-5802, entry-5831, entry-5855, entry-5892, entry-6407, entry-6434, entry-6462, entry-6503, entry-6528, entry-6604, entry-6630, entry-6651, entry-6682, entry-6730, entry-6752, entry-6771, entry-6807, entry-6826, entry-6881, entry-6918, entry-6952. These remain pending; the coordinator did not duplicate research or infer completion from other workers’ batches.

Source-to-fact QA preserves the worker notes for every terminal row. Mapping classes across all 270 keys: 60 explicit per-source notes, 30 explicit URL-object notes, 30 fact rows that name their URL, 54 single-URL/global-fact rows, 66 multi-URL/global-fact rows flagged as mapping caveats, and 30 pending rows. No terminal row lacked both a source URL and supported facts. The 66 multi-URL/global-fact rows remain proposals with an attribution caveat; this QA does not infer that every URL supports every listed fact. Explicit per-URL/per-source mapping is distinguished from single-source global facts and multi-source global facts only. Rows with multiple URLs but unbound global facts are flagged as mapping caveats rather than treated as proof that every source supports every fact. Corrections, unsupported original claims, access notes, and exact gaps are included per row.

No edits were made to worker outputs, canonical records, scores, or databases. This coordinator produced only an append-only QA batch and checkpoint artifacts.

## Worker coverage

| Worker | Assigned | Terminal | Pending | Batch files |
|---:|---:|---:|---:|---:|
| 4 | 30 | 30 | 0 | 6 |
| 5 | 30 | 0 | 30 | 0 |
| 6 | 30 | 30 | 0 | 3 |
| 7 | 30 | 30 | 0 | 6 |
| 8 | 30 | 30 | 0 | 3 |
| 9 | 30 | 30 | 0 | 3 |
| 10 | 30 | 30 | 0 | 8 |
| 11 | 30 | 30 | 0 | 4 |
| 12 | 30 | 30 | 0 | 6 |

Artifacts: `data/neon-workbench/external/account2-coordination-2026-10-03/worker-17/worker-17-source270-qa-batch-001.jsonl`, `data/neon-workbench/external/account2-coordination-2026-10-03/worker-17/worker-17-checkpoint-001.json`, `data/neon-workbench/external/account2-coordination-2026-10-03/worker-17/worker-17-final-exact-set-qa.json`.
