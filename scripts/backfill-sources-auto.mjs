#!/usr/bin/env node
/**
 * Automated source backfill using Exa REST API.
 * Writes to BOTH trump_entries.sources (JSONB) AND trump_sources (canonical table).
 * Uses semantic matching to verify the Exa result actually covers the same event.
 * Marks rejected entries with a dated retry sentinel so they do not stall the cursor.
 *
 * Env vars:
 *   DATABASE_URL      — Neon connection string
 *   EXA_API_KEY       — primary Exa key
 *   EXA_API_KEY_2     — optional second key
 *   EXA_API_KEY_3     — optional third key
 *   BATCH_SIZE        — entries per run (default 200)
 *   START_ENTRY       — floor entry number (default 1)
 *   END_ENTRY         — ceiling entry number (default 9999)
 */

import { neon } from '@neondatabase/serverless';
import { RETRY_DAYS } from './backfill-sources-state.mjs';

const VALID_SOURCE_URL_PATTERN = '^https?://[^\\s/?#]+(?:[/?#]|$)';

const DATABASE_URL = process.env.DATABASE_URL;
const EXA_KEYS = [
  process.env.EXA_API_KEY,
  process.env.EXA_API_KEY_2,
  process.env.EXA_API_KEY_3,
].filter(Boolean);

if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
if (!EXA_KEYS.length) { console.error('At least one EXA_API_KEY required'); process.exit(1); }

const requestedBatchSize = Number.parseInt(process.env.BATCH_SIZE ?? '25', 10);
const BATCH_SIZE = Number.isFinite(requestedBatchSize)
  ? Math.min(Math.max(requestedBatchSize, 1), 50)
  : 25;
const START_ENTRY = parseInt(process.env.START_ENTRY ?? '1', 10);
const END_ENTRY = parseInt(process.env.END_ENTRY ?? '9999', 10);

const sql = neon(DATABASE_URL);
let _exaIdx = 0;
const getExaKey = () => EXA_KEYS[_exaIdx++ % EXA_KEYS.length];

// ── Accepted reputable outlets ────────────────────────────────────────────────

const ACCEPTED_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'nytimes.com', 'washingtonpost.com',
  'cnn.com', 'bbc.com', 'bbc.co.uk', 'politico.com', 'theguardian.com',
  'nbcnews.com', 'npr.org', 'cnbc.com', 'theatlantic.com', 'axios.com',
  'propublica.org', 'cbsnews.com', 'abcnews.go.com', 'pbs.org',
  'vox.com', 'newyorker.com', 'texastribune.org', 'thehill.com',
  'dailybeast.com', 'politifact.com', 'time.com', 'bloomberg.com',
  'ft.com', 'wsj.com', 'usatoday.com', 'motherjones.com',
]);

function isAcceptedDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return [...ACCEPTED_DOMAINS].some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

// ── Semantic match scoring ────────────────────────────────────────────────────
// Returns 0-1 confidence that the Exa result covers the same event as the entry.

function semanticMatchScore(entry, exaResult) {
  if (!exaResult) return 0;

  const entryText = `${entry.title} ${entry.synopsis ?? ''}`.toLowerCase();
  const resultText = `${exaResult.title ?? ''} ${exaResult.text ?? ''}`.toLowerCase();

  // Year check: dates must be compatible (within 1 year)
  let dateScore = 0;
  if (entry.date_start && exaResult.publishedDate) {
    const entryYear = new Date(entry.date_start).getFullYear();
    const exaYear = new Date(exaResult.publishedDate).getFullYear();
    if (Math.abs(entryYear - exaYear) === 0) dateScore = 1;
    else if (Math.abs(entryYear - exaYear) === 1) dateScore = 0.4;
    else dateScore = 0; // too far apart
  } else {
    dateScore = 0.3; // unknown dates get partial credit
  }

  // Extract meaningful words from entry title (3+ chars, not stop words)
  const stopWords = new Set(['the','and','for','are','but','not','with','from','that','this','was','had','has','have','its','been','they','will','when','what','who','how','can','did','does','said','after','into']);
  const entryKeywords = entryText
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));

  if (entryKeywords.length === 0) return 0;

  // Count how many entry keywords appear in the Exa result text
  const matchedKeywords = entryKeywords.filter(kw => resultText.includes(kw));
  const keywordScore = matchedKeywords.length / entryKeywords.length;

  // HARD FLOOR: keyword overlap must pass independently of date
  // This prevents a same-year but totally unrelated article from passing
  if (keywordScore < MIN_KEYWORD_SCORE) return 0;

  // Combined score: keyword overlap matters most, date is supporting signal only
  const combined = keywordScore * 0.7 + dateScore * 0.3;
  return combined;
}

// Match thresholds — keyword overlap is REQUIRED independently of date
const MIN_KEYWORD_SCORE = 0.15; // hard floor: at least 15% of title keywords must appear in result
const MIN_COMBINED_SCORE = 0.30; // final combined threshold

// ── Exa search ────────────────────────────────────────────────────────────────

async function searchExa(query) {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': getExaKey() },
    body: JSON.stringify({
      query,
      numResults: 3,
      useAutoprompt: false,
      contents: { text: { maxCharacters: 300 } },
    }),
  });
  if (!res.ok) {
    console.warn(`Exa ${res.status} for query: ${query.slice(0, 60)}`);
    return [];
  }
  const data = await res.json();
  return (data.results ?? []).filter(r => isAcceptedDomain(r.url));
}

// ── Write source to both places ───────────────────────────────────────────────

async function persistSource(entry, result) {
  const sourceObj = { url: result.url, title: result.title ?? entry.title, source_type: 'news' };

  // 1. Update trump_entries.sources JSONB (denormalized cache for fast reads)
  await sql`
    UPDATE trump_entries
    SET sources = ${JSON.stringify([sourceObj])}::jsonb
    WHERE entry_number = ${entry.entry_number}
  `;

  // 2. Upsert into trump_sources (canonical normalized table)
  const publisherHost = new URL(result.url).hostname.replace(/^www\./, '');
  let publishedDate = null;
  if (result.publishedDate) {
    try { publishedDate = new Date(result.publishedDate).toISOString().slice(0, 10); } catch { /* skip */ }
  }

  await sql`
    INSERT INTO trump_sources (entry_number, url, title, publisher, date_published, source_type)
    VALUES (
      ${entry.entry_number},
      ${result.url},
      ${result.title ?? entry.title},
      ${publisherHost},
      ${publishedDate},
      'news'
    )
    ON CONFLICT (entry_number, url) DO NOTHING
  `;
}

// ── Mark entry as skip-for-now (dated sentinel, NOT permanent — retryable after ~30 days) ──
// Uses {"searched": "YYYY-MM-DD"} rather than [] so:
//   - cursor advances past it today
//   - future runs can re-try old entries by clearing this marker
//   - catalog card shows nothing (no url field)

async function markSkipped(entry_number) {
  const today = new Date().toISOString().slice(0, 10);
  await sql`
    UPDATE trump_entries
    SET sources = ${JSON.stringify([{ searched: today }])}::jsonb
    WHERE entry_number = ${entry_number}
      AND (
        sources IS NULL
        OR sources::text = 'null'
        OR sources::text = '[]'
        OR (
          CASE WHEN jsonb_typeof(sources) = 'array' THEN jsonb_array_length(sources) ELSE 0 END = 1
          AND COALESCE(sources->0->>'url', '') = ''
          AND CASE
            WHEN COALESCE(sources->0->>'searched', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
            THEN (sources->0->>'searched')::date
            ELSE NULL
          END < CURRENT_DATE - (${RETRY_DAYS} * INTERVAL '1 day')
        )
        OR (
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(sources) = 'array' THEN sources ELSE '[]'::jsonb END) AS item
            WHERE COALESCE(item->>'url', '') <> ''
          )
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(sources) = 'array' THEN sources ELSE '[]'::jsonb END) AS item
            WHERE COALESCE(item->>'url', '') ~* ${VALID_SOURCE_URL_PATTERN}
          )
        )
      )
  `;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`Backfill: entries ${START_ENTRY}–${END_ENTRY}, batch=${BATCH_SIZE}`);

  // Fetch entries that genuinely lack a real source.
  // Excluded:
  //   - sources with a real URL (sources @> '[{"url":"..."}]' pattern — has url key)
  //   - dated skip markers: [{"searched":"..."}] — already attempted this cycle
  // Included:
  //   - sources IS NULL or 'null' = never tried
  //   - old [] sentinel (pre-fix legacy)
  //   - skip markers older than 30 days (retry)
  const rows = await sql`
    SELECT entry_number, title, synopsis, date_start
    FROM trump_entries
    WHERE entry_number BETWEEN ${START_ENTRY} AND ${END_ENTRY}
      AND (
        sources IS NULL
        OR sources::text = 'null'
        OR sources::text = '[]'
        OR (
          -- dated skip with no real url: retry after RETRY_DAYS
          CASE WHEN jsonb_typeof(sources) = 'array' THEN jsonb_array_length(sources) ELSE 0 END = 1
          AND COALESCE(sources->0->>'url', '') = ''
          AND CASE
            WHEN COALESCE(sources->0->>'searched', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
            THEN (sources->0->>'searched')::date
            ELSE NULL
          END < CURRENT_DATE - (${RETRY_DAYS} * INTERVAL '1 day')
        )
        OR (
          -- malformed URL arrays are eligible for repair, but valid URLs are never overwritten here
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(sources) = 'array' THEN sources ELSE '[]'::jsonb END) AS item
            WHERE COALESCE(item->>'url', '') <> ''
          )
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(sources) = 'array' THEN sources ELSE '[]'::jsonb END) AS item
            WHERE COALESCE(item->>'url', '') ~* ${VALID_SOURCE_URL_PATTERN}
          )
        )
      )
    ORDER BY entry_number
    LIMIT ${BATCH_SIZE}
  `;

  console.log(`Found ${rows.length} eligible entries (missing, legacy empty, or expired skip)`);
  if (rows.length === 0) {
    console.log('All entries in range have been attempted. Done.');
    return;
  }

  let updated = 0, skipped = 0;

  for (const row of rows) {
    const year = row.date_start ? new Date(row.date_start).getFullYear() : '';

    // Query 1: full title + year
    const q1 = `${row.title} ${year}`.trim();
    let candidates = await searchExa(q1);

    // Query 2: simplified title if q1 returns nothing
    if (candidates.length === 0) {
      const simplified = row.title
        .replace(/^Trump['']?s?\s+/i, '')
        .replace(/^Donald Trump\s+/i, '')
        .slice(0, 80);
      candidates = await searchExa(`${simplified} ${year}`);
    }

    // Score all candidates and pick the best match
    let best = null, bestScore = 0;
    for (const c of candidates) {
      const score = semanticMatchScore(row, c);
      if (score > bestScore) { bestScore = score; best = c; }
    }

    if (best && bestScore >= MIN_COMBINED_SCORE) {
      await persistSource(row, best);
      console.log(`  #${row.entry_number} ✓ (score=${bestScore.toFixed(2)}) ${best.url.slice(0, 70)}`);
      updated++;
    } else {
      // Refresh the dated retry marker so this row leaves the next ordered batch.
      await markSkipped(row.entry_number);
      if (best) {
        console.log(`  #${row.entry_number} ✗ best score too low (${bestScore.toFixed(2)}): ${best.url.slice(0, 60)}`);
      } else {
        console.log(`  #${row.entry_number} ✗ no accepted-domain results`);
      }
      skipped++;
    }

    // ~250ms between requests to stay within free tier rate limit
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);

  const [rem] = await sql`
    SELECT COUNT(*) as c FROM trump_entries
    WHERE entry_number BETWEEN ${START_ENTRY} AND ${END_ENTRY}
      AND (sources IS NULL OR sources::text = 'null')
  `;
  console.log(`Remaining untried in range: ${rem.c}`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
