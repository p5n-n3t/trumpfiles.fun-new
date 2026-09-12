import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stageClaims, writeStageOutput } from './stage-trump-claims.mjs';

async function fixture() { const dir = await mkdtemp(path.join(tmpdir(), 'claims-')); await writeFile(path.join(dir, 'wapo_trumpclaims_export-012021.csv'), 'id,location,claim,analysis,pinocchios,category,repeated_ids,repeated_count,date\n1,Speech,"A long, quoted claim,\nwith a line break",Analysis with https://example.org/source.,Four,Election,R1,2,01/20/2021\n2,Rally,"A long, quoted claim,\nwith a line break",Other analysis.,Three,Election,R1,2,01/20/2021\n'); await writeFile(path.join(dir, 'false-claim-info.csv'), 'claim_text,unique_claim,repeated_ids,cat_mode,start_date\n"A separate long claim with enough words to stage",U1,R1,Election,01/20/2021\n'); return dir; }

test('parses multiline quoted fields, explicit repeats, URLs, and excludes analysis prose', async () => { const result = await stageClaims({ inputDir: await fixture(), maxCandidates: 10 }); assert.equal(result.records.length, 1); const repeated = result.records[0]; assert.equal(repeated.occurrence_ids.includes('1'), true); assert.equal(repeated.evidence_urls[0].status, 'unverified'); assert.equal(repeated.contract_preview.phase, 'White House 1'); assert.equal(repeated.contract_preview.date_start, '2021-01-20'); assert.equal(repeated.contract_preview.synopsis, null); assert.equal(JSON.stringify(repeated).includes('Analysis with'), false); assert.match(repeated.canonical_id, /^evt-wapo-[a-z0-9]+$/); });
test('fingerprints and ordering are idempotent', async () => { const dir = await fixture(); const a = await stageClaims({ inputDir: dir, maxCandidates: 10 }); const b = await stageClaims({ inputDir: dir, maxCandidates: 10 }); assert.deepEqual(a, b); });
test('keeps canonical ID stable while content fingerprint changes, retaining provenance and ratings', async () => { const dir = await fixture(); const before = await stageClaims({ inputDir: dir, maxCandidates: 10 }); const file = path.join(dir, 'false-claim-info.csv'); const source = await readFile(file, 'utf8'); await writeFile(file, source.replace('A separate long claim with enough words to stage', 'A revised wording of the same curated claim with enough words to stage')); const after = await stageClaims({ inputDir: dir, maxCandidates: 10 }); assert.equal(before.records[0].canonical_id, after.records[0].canonical_id); assert.notEqual(before.records[0].fingerprint, after.records[0].fingerprint); assert.equal(after.records[0].occurrences[0].source_file, 'wapo_trumpclaims_export-012021.csv'); assert.equal(after.records[0].occurrences[0].pinocchios, 'Four'); assert.equal('repeated_ids' in after.records[0].occurrences[0], false); });
test('quarantines missing source, unmapped taxonomy/phase, and missing contract fields', async () => { const result = await stageClaims({ inputDir: await fixture(), maxCandidates: 10 }); const record = result.records[0]; assert.equal(record.action, 'quarantine'); assert.ok(record.reasons.includes('missing_verified_source')); assert.ok(record.reasons.includes('missing_contract_summaries')); assert.ok(record.reasons.includes('missing_contract_scores')); });
test('enforces candidate cap and hard maximum', async () => { const dir = await fixture(); await assert.rejects(() => stageClaims({ inputDir: dir, maxCandidates: 201 }), /1-200/); const result = await stageClaims({ inputDir: dir, maxCandidates: 1 }); assert.equal(result.records.length, 1); assert.equal(result.manifest.curated_linked_groups, 1); assert.equal(result.manifest.occurrence_only_groups, 0); assert.equal(result.manifest.omitted_by_cap, 0); });
test('does not write by default and writes only with explicit output directory', async () => { const dir = await fixture(); const result = await stageClaims({ inputDir: dir }); assert.deepEqual((await readdir(dir)).sort(), ['false-claim-info.csv', 'wapo_trumpclaims_export-012021.csv']); const output = await mkdtemp(path.join(tmpdir(), 'claims-out-')); await writeStageOutput(result, output); assert.match(await readFile(path.join(output, 'claims.jsonl'), 'utf8'), /evt-wapo/); });
test('reconciles a missing curated repeat ID only on an exact normalized claim', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'claims-fallback-'));
  await writeFile(path.join(dir, 'wapo_trumpclaims_export-012021.csv'), 'id,claim,repeated_ids,date,category\n7,"Exact claim with punctuation, and spacing.",R7,01/20/2021,Election\n');
  await writeFile(path.join(dir, 'false-claim-info.csv'), 'claim_text,unique_claim,cat_mode,start_date\n" exact   claim with punctuation and spacing ",U7,Election,01/20/2021\n');
  const result = await stageClaims({ inputDir: dir, maxCandidates: 10 });
  assert.equal(result.manifest.total_groups, 1);
  assert.equal(result.manifest.curated_linked_groups, 1);
  assert.deepEqual(result.records[0].occurrence_ids, ['7', 'R7', 'U7']);
});
test('does not emit raw repeated ID fields', async () => {
  const dir = await fixture();
  const result = await stageClaims({ inputDir: dir, maxCandidates: 10 });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('"repeated_ids"'), false);
  assert.equal(serialized.includes('Analysis with'), false);
});
