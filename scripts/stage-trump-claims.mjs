import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const DEFAULT_INPUT = '/home/jq/Desktop/trump_claims';
const HARD_MAX = 200;
const DEFAULT_MAX = 150;

function parseCsv(text, project) {
  const output = []; const row = []; let headers; let value = ''; let quoted = false; let rowNumber = 0;
  const add = fields => {
    if (!fields.some(Boolean)) return;
    if (!headers) headers = fields.map(header => header.replace(/^\uFEFF/, '').trim());
    else { rowNumber += 1; output.push(project(Object.fromEntries(headers.map((key, i) => [key, fields[i] ?? ''])), rowNumber + 1)); }
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); add(row.splice(0)); value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('unterminated quoted CSV field');
  if (value.length || row.length) { row.push(value); add(row); }
  return output;
}

function clean(value) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''; }
function normalizeClaim(value) { return clean(value).normalize('NFKC').toLowerCase().replace(/[“”"'’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function digest(value) { return createHash('sha256').update(value).digest('hex').slice(0, 24); }
function urlsFrom(...values) { const urls = new Set(); for (const value of values) for (const match of String(value ?? '').matchAll(/https?:\/\/[^\s"'<>]+/g)) urls.add(match[0].replace(/[),.;]+$/, '')); return [...urls].sort(); }
function dateValue(value) {
  const raw = clean(value); if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) { const parsed = new Date(`${raw}T00:00:00Z`); return parsed.toISOString().slice(0, 10) === raw ? raw : null; }
  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) { const [, month, day, year] = slash; const iso = `${year}-${month}-${day}`; const parsed = new Date(`${iso}T00:00:00Z`); if (parsed.toISOString().slice(0, 10) === iso) return iso; return null; }
  if (/^\d+(?:\.\d+)?$/.test(raw)) { const date = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000); return date.toISOString().slice(0, 10); }
  return null;
}
function phaseFor(date) { if (!date) return null; if (date >= '2016-01-01' && date <= '2016-11-08') return 'Campaign 2016'; if (date >= '2017-01-20' && date <= '2021-01-20') return 'White House 1'; return null; }
function categoryFor(raw) { return ({ election: 'Election Interference', 'foreign policy': 'Foreign Policy' })[clean(raw).toLowerCase()] ?? null; }
function identifier(record, curated, cache) {
  const repeated = record.repeated_ids;
  if (repeated) {
    const cached = cache.get(repeated); if (cached) return cached;
    const tokens = [...new Set(repeated.split(/[,\s|;]+/).map(token => token.replace(/^0+(?=\d)/, '')).filter(Boolean))].sort();
    const identity = { tokens, key: `ids:${digest(tokens.join('|'))}` }; cache.set(repeated, identity); return identity;
  }
  if (!curated && record.id) return { tokens: [record.id], key: `ids:${digest(record.id)}` };
  return { tokens: [], key: null };
}
function projectRow(row, sourceFile, sourceKind, rowNumber) {
  const claim = clean(row.claim || row.claim_text);
  return {
    source_file: sourceFile, source_kind: sourceKind, source_row: rowNumber,
    id: clean(row.id || row.unique_claim), claim, normalized_claim: normalizeClaim(claim),
    date: dateValue(row.date || row.start_date), location: clean(row.location || row.loc_mode),
    original_category: clean(row.category || row.cat_mode) || null, pinocchios: clean(row.pinocchios) || null,
    repeated_ids: clean(row.repeated_ids), repeated_count: Number(row.repeated_count || row.repetitions) || 0,
    evidence_urls: urlsFrom(claim, row.analysis),
  };
}
function candidateFrom(group, groupKey) {
  const first = group.find(item => item.source_kind === 'false_claim_info') ?? group[0];
  const { claim, date, original_category: rawCategory } = first;
  const occurrences = group.map(item => ({ source_file: item.source_file, source_kind: item.source_kind, source_row: item.source_row, id: item.id, date: item.date, location: item.location, original_category: item.original_category, pinocchios: item.pinocchios })).filter(item => item.id || item.date || item.location);
  const evidenceUrls = [...new Set(group.flatMap(item => item.evidence_urls))].sort();
  const category = categoryFor(rawCategory); const phase = phaseFor(date); const reasons = [];
  if (claim.length < 20) reasons.push('claim_too_short'); if (!date) reasons.push('malformed_or_missing_date'); if (!category) reasons.push('unmapped_category'); if (!phase) reasons.push('unmapped_phase');
  reasons.push('missing_verified_source', 'missing_contract_summaries', 'missing_contract_scores');
  const fingerprint = digest(JSON.stringify({ claim: normalizeClaim(claim), date, ids: occurrences.map(item => item.id).sort() }));
  const canonicalStem = digest(groupKey);
  return {
    canonical_id: `evt-wapo-${canonicalStem || fingerprint}`, fingerprint, claim,
    occurrence_ids: [...new Set(group.flatMap(item => [item.id, ...(item.identity_tokens ?? [])]).filter(Boolean))].sort(), occurrences,
    original_category: rawCategory, repetition: { repeated_count: first.repeated_count },
    evidence_urls: evidenceUrls.map(url => ({ url, status: 'unverified', source: 'embedded_dataset_link' })),
    provenance: { source_file: first.source_file, source_row: first.source_row, source_kind: first.source_kind },
    action: 'quarantine', reasons: [...new Set(reasons)],
    contract_preview: { title: claim.slice(0, 160) || null, synopsis: null, short_summary: null, medium_summary: null, long_summary: null, category, phase, date_start: date, people_tags: ['Donald Trump'], sources: evidenceUrls.map(url => ({ url, status: 'unverified', source_type: 'dataset_embedded_link', confidence: null })), danger: null, authoritarianism: null, lawlessness: null, insanity: null, absurdity: null },
  };
}

export async function stageClaims({ inputDir = DEFAULT_INPUT, maxCandidates = DEFAULT_MAX } = {}) {
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > HARD_MAX) throw new Error(`maxCandidates must be 1-${HARD_MAX}`);
  const records = [];
  for (const [name, kind] of [['wapo_trumpclaims_export-012021.csv', 'wapo_occurrence'], ['false-claim-info.csv', 'false_claim_info']]) {
    let text; try { text = await readFile(path.join(inputDir, name), 'utf8'); } catch { continue; }
    records.push(...parseCsv(text, (row, number) => projectRow(row, name, kind, number)));
  }
  const groups = new Map(); const identityCache = new Map();
  for (const record of records) {
    const curated = record.source_kind === 'false_claim_info'; const identity = identifier(record, curated, identityCache); record.identity_tokens = identity.tokens;
    if (!curated || identity.key) { const key = identity.key ?? `claim:${digest(record.normalized_claim)}`; (groups.get(key) ?? groups.set(key, []).get(key)).push(record); }
  }
  for (const record of records) delete record.repeated_ids;
  identityCache.clear();
  const occurrenceClaimGroups = new Map();
  for (const [key, group] of groups) if (group.some(item => item.source_kind === 'wapo_occurrence')) for (const claim of new Set(group.map(item => item.normalized_claim).filter(Boolean))) occurrenceClaimGroups.set(claim, [...(occurrenceClaimGroups.get(claim) ?? []), key]);
  for (const record of records) if (record.source_kind === 'false_claim_info' && !record.identity_tokens.length) {
    const matches = occurrenceClaimGroups.get(record.normalized_claim) ?? []; const key = matches.length === 1 ? matches[0] : `curated:${digest(record.normalized_claim)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)).push(record);
  }
  const all = [...groups.entries()].map(([groupKey, group]) => ({ groupKey, group, curated_linked: group.some(item => item.source_kind === 'false_claim_info') }));
  const curatedLinkedGroups = all.filter(item => item.curated_linked).length;
  const prioritized = all.sort((a, b) => Number(b.curated_linked) - Number(a.curated_linked) || a.groupKey.localeCompare(b.groupKey));
  const capped = prioritized.slice(0, maxCandidates).map(item => candidateFrom(item.group, item.groupKey)).sort((a, b) => a.canonical_id.localeCompare(b.canonical_id));
  return { manifest: { schema: 'trump-claims-staging-1', input_dir: inputDir, candidate_count: capped.length, total_groups: all.length, curated_linked_groups: curatedLinkedGroups, occurrence_only_groups: all.length - curatedLinkedGroups, omitted_by_cap: all.length - capped.length, max_candidates: maxCandidates, analysis_included: false }, records: capped };
}
export async function writeStageOutput(result, outputDir) { if (!outputDir) return false; await mkdir(outputDir, { recursive: true }); await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(result.manifest, null, 2)}\n`); await writeFile(path.join(outputDir, 'claims.jsonl'), `${result.records.map(record => JSON.stringify(record)).join('\n')}\n`); return true; }
function args(argv) { const out = {}; for (let i = 0; i < argv.length; i += 1) { if (argv[i] === '--input-dir') out.inputDir = argv[++i]; else if (argv[i] === '--max-candidates') out.maxCandidates = Number(argv[++i]); else if (argv[i] === '--output-dir') out.outputDir = argv[++i]; } return out; }
if (import.meta.url === `file://${process.argv[1]}`) { const options = args(process.argv.slice(2)); stageClaims(options).then(async result => { await writeStageOutput(result, options.outputDir); console.log(JSON.stringify(result.manifest)); if (!options.outputDir) for (const record of result.records) console.log(JSON.stringify(record)); }).catch(error => { console.error(error.message); process.exitCode = 1; }); }
