# Worker 13 sample100 release-gate reconciliation — proposal only

Frozen packet: `86d71a0bcd9d82301e72bc9f36a4271143c87ddb`. The checkpoint records exact input hashes and latest branch commits. The ledger has one effective result for each of the 100 manifest keys.

Independent checks: identity 100/100; text lengths 100/100; canonical six-dimension score formula 100/100; original synopsis text appears verbatim somewhere in staged short/medium/long for 96/100. Only 11/100 shorts equal frozen synopsis. The legacy adapter maps the short summary to `synopsis` and omits medium/long. Therefore the projection-aware preservation gate holds 89 records: 88 shorts are title copies and one is a different rewrite.

Latest worker row verdicts: 66 PASS / 34 HOLD. Final proposed gate after retaining worker HOLDs and applying projection-aware preservation: 7 PASS / 93 HOLD. No worker HOLD was changed to PASS. Separately, four records (`entry-2, entry-7, entry-8, entry-12`) lose the frozen synopsis from all three staged description fields.

Blockers: worker 07/10/11 lack final exact-set attestations; worker 12’s QA markdown states noncanonical formula weights although all its row scores match independent recomputation; and 89 rows do not preserve the frozen synopsis through the legacy short-to-synopsis projection. Record-specific reasons are in `blockers.jsonl`.

This is an offline proposal only. URL content and live target NULL state were not checked. No canonical edits, SQL/Neon activity, or PR were performed.
