#!/usr/bin/env node
/**
 * Trump Files — Automated Entry Update
 *
 * Provider-agnostic research pipeline. Any AI agent can call this.
 * Uses Gemini (via agy) for research to preserve Claude/Bedrock quota.
 *
 * Steps:
 *   1. Query DB for current max entry_number + last date
 *   2. Call Gemini to research new Trump events since last update
 *   3. Format entries to DB schema
 *   4. Validate structure (required fields, category vocabulary, phase)
 *   5. INSERT directly into Neon (bypasses upload API for cron reliability)
 *   6. Trigger Vectorize ingest on Cloudflare Worker
 *
 * Env vars:
 *   DATABASE_URL      — Neon connection string
 *   GEMINI_API_KEY    — Google AI Studio key (free tier OK for cron)
 *   INGEST_SECRET     — CF Worker bearer token
 *   WORKER_URL        — Cloudflare Worker base URL
 *   DRY_RUN           — 'true' to skip DB writes
 *   MAX_ENTRIES       — max entries to insert per run (default 10)
 */

import { neon } from '@neondatabase/serverless';
import { normalizeEnrichment, toLegacyEntry, validateEnrichment } from './enrichment-contract.mjs';

const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // no longer required — kept for backward compat
const INGEST_SECRET = process.env.INGEST_SECRET;
const WORKER_URL = process.env.WORKER_URL || 'https://trumpstein.trumpstein.workers.dev';
const RUN_LIVE = process.env.RUN_LIVE === 'true';
const DRY_RUN = !RUN_LIVE || process.env.DRY_RUN !== 'false';
const requestedMaxEntries = Number.parseInt(process.env.MAX_ENTRIES || '5', 10);
const MAX_ENTRIES = Number.isFinite(requestedMaxEntries)
  ? Math.min(Math.max(requestedMaxEntries, 1), 10)
  : 5;

// Exa key rotation — cycle through available keys to distribute load
const EXA_KEYS = [
  process.env.EXA_API_KEY,
  process.env.EXA_API_KEY_2,
  process.env.EXA_API_KEY_3,
].filter(Boolean);
let exaKeyIndex = 0;
const getExaKey = () => EXA_KEYS[exaKeyIndex++ % EXA_KEYS.length];

if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
if (!INGEST_SECRET) { console.error('INGEST_SECRET required'); process.exit(1); }

const sql = neon(DATABASE_URL);

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getState() {
  const rows = await sql`
    SELECT MAX(entry_number) as max_entry, MAX(date_start) as last_date
    FROM trump_entries
  `;
  return {
    maxEntry: parseInt(rows[0]?.max_entry || '5000', 10),
    lastDate: rows[0]?.last_date
      ? new Date(rows[0].last_date).toISOString().split('T')[0]
      : '2026-08-01',
  };
}

// ── Research: Exa (mandatory) + CF Workers AI to structure ───────────────────

async function researchAndStructure(lastDate, maxEntry) {
  // FAIL CLOSED: no Exa keys = no run
  if (EXA_KEYS.length === 0) {
    throw new Error('No EXA_API_KEY configured. Cannot research without real sources.');
  }

  // Step 1: Fetch real recent Trump news via Exa (MANDATORY)
  let articles = [];
  const exaKey = getExaKey();
  const exaRes = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': exaKey },
    body: JSON.stringify({
      query: `Trump scandal corruption abuse power news`,
      numResults: MAX_ENTRIES + 2, // fetch a few extra in case some fail validation
      contents: { text: { maxCharacters: 600 } },
      useAutoprompt: true,
      startPublishedDate: lastDate, // ISO date string e.g. "2026-08-09"
    }),
  });

  if (!exaRes.ok) {
    const errText = await exaRes.text();
    throw new Error(`Exa search failed ${exaRes.status}: ${errText}`);
  }

  const exaData = await exaRes.json();
  articles = (exaData.results ?? []).filter(r => r.url && !r.url.includes('example.com'));

  if (articles.length === 0) {
    throw new Error(`Exa returned 0 real articles since ${lastDate}. Aborting — no fabrication allowed.`);
  }

  console.log(`Exa found ${articles.length} real articles since ${lastDate}`);

  // Step 2: Build article map keyed by URL for reliable source attachment
  const articleByUrl = new Map(articles.map(a => [a.url, a]));

  // Step 3: Ask CF Workers AI to cluster articles by event, then produce ONE entry per event
  const systemPrompt = `You are a data curator for TrumpFiles. Your job is to:
1. GROUP the provided articles by the REAL-WORLD EVENT they describe (multiple articles can cover the same event)
2. For each DISTINCT event, produce ONE entry with ALL article URLs for that event as sources
3. NEVER invent any facts — every claim must come directly from the articles

STRICT RULES:
- One entry per unique event, not one entry per article
- source_urls array must list the EXACT URLs of every article about that event
- NEVER invent events, quotes, dollar amounts, names, URLs
- Skip articles not about Trump misconduct/scandal

VALID CATEGORIES: "Authoritarianism" | "Government Corruption" | "Human Rights Violations" | "Grift / Financial Exploitation" | "National Security Violations" | "Foreign Policy" | "Election Interference" | "Press Freedom" | "Environmental Destruction" | "Conspiracy Theories / Disinformation"
VALID PHASES: "Pre-Political" | "Campaign 2016" | "White House 1" | "White House 2:2"

Return ONLY a valid JSON array. No markdown, no explanation.`;

  const newsContext = articles.map((r, i) =>
    `[${i+1}] ARTICLE_URL: ${r.url}\nHEADLINE: ${r.title}\nDATE: ${r.publishedDate ?? ''}\nSUMMARY: ${r.text ?? ''}`
  ).join('\n\n---\n\n');

  const userPrompt = `Group these ${articles.length} articles by real-world event. For each DISTINCT event return ONE object:
{
  "title": "punchy headline from article facts only",
  "short_summary": "1-2 concise sentences for a catalogue card, naming the core who/what/when",
  "medium_summary": "3-5 factual sentences for a dossier, adding evidence-supported context",
  "long_summary": "6-10 factual sentences with who, what, when, sequence, context, and clearly attributed allegations",
  "category": "<valid category>",
  "phase": "White House 2:2",
  "date_start": "YYYY-MM-DD",
  "people_tags": ["Full Name"],
  "source_urls": ["<URL1>", "<URL2>"],
  "danger": 1-10, "authoritarianism": 1-10, "lawlessness": 1-10, "insanity": 1-10, "absurdity": 1-10
}

ARTICLES:
${newsContext}

Return ONLY valid JSON array. Group same-event articles together.`;

  const workerUrl = WORKER_URL || 'https://trumpstein.trumpstein.workers.dev';
  const cfRes = await fetch(`${workerUrl}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${INGEST_SECRET}` },
    body: JSON.stringify({ system: systemPrompt, user: userPrompt, max_tokens: 4096 }),
  });

  if (!cfRes.ok) throw new Error(`CF Workers AI error ${cfRes.status}: ${await cfRes.text()}`);

  const cfData = await cfRes.json();
  const rawResponse = cfData.response ?? cfData.text ?? '[]';

  // llama fp8-fast returns response as parsed JSON array/object directly
  // QwQ-32b returns response as a string (may have <think> tokens or ```json fences)
  let entries = [];
  try {
    if (Array.isArray(rawResponse)) {
      // Already parsed by the worker
      entries = rawResponse;
    } else {
      const rawText = String(rawResponse);
      const stripped = rawText
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();
      const jsonMatch = stripped.match(/\[[\s\S]*\]/);
      entries = JSON.parse(jsonMatch ? jsonMatch[0] : stripped);
    }
  } catch (parseErr) {
    console.warn('JSON parse failed:', parseErr.message?.slice(0, 80));
    console.warn('rawResponse type:', typeof rawResponse, 'snippet:', String(rawResponse).slice(0, 200));
    return [];
  }

  if (!Array.isArray(entries)) return [];

  // Step 4: Validate all source_urls against Exa results — reject any invented URLs
  const verified = entries
    .map(e => {
      const rawUrls = Array.isArray(e.source_urls) ? e.source_urls : (e.source_url ? [e.source_url] : []);
      const verifiedSources = rawUrls
        .map(url => {
          if (!url || url.includes('example.com') || url.includes('placeholder')) return null;
          const exaArticle = articleByUrl.get(url);
          if (exaArticle) return { url: exaArticle.url, title: exaArticle.title, source_type: 'news', status: 'verified', confidence: 1 };
          // Fuzzy match: model may have slightly mangled URL
          try {
            const path = new URL(url).pathname.slice(0, 30);
            const match = articles.find(a => a.url.includes(path));
            if (match) return { url: match.url, title: match.title, source_type: 'news', status: 'verified', confidence: 1 };
          } catch { /* invalid URL */ }
          console.warn(`SKIP URL not from Exa: ${url.slice(0, 60)}`);
          return null;
        })
        .filter(Boolean);
      if (verifiedSources.length === 0) return null; // no real source = skip entry
      return { ...e, sources: verifiedSources };
    })
    .filter(Boolean);

  // This is the single contract boundary for new entries. The database still
  // stores legacy columns below; no unvalidated model field reaches persistence.
  return verified.flatMap(entry => {
    const normalized = normalizeEnrichment(entry, {
      source: 'auto-update', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    });
    const result = validateEnrichment(normalized, entry);
    if (!result.ok) {
      console.warn(`SKIP invalid enrichment: ${result.errors.join('; ')}`);
      return [];
    }
    return [result.value];
  });
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(entry) {
  return validateEnrichment(entry).errors;
}

// ── DB insert ─────────────────────────────────────────────────────────────────

async function insertEntry(entry, entryNumber) {
  const legacy = toLegacyEntry(entry);
  const tags = legacy.people_tags;
  const sourcesJson = legacy.sources ? JSON.stringify(legacy.sources) : null;

  await sql`
    INSERT INTO trump_entries (entry_number, title, synopsis, category, phase, date_start, people_tags, sources)
    VALUES (
      ${entryNumber},
      ${legacy.title},
      ${legacy.synopsis},
      ${legacy.category},
      ${legacy.phase},
      ${legacy.date_start},
      ${tags},
      ${sourcesJson ? sql`${sourcesJson}::jsonb` : null}
    )
    ON CONFLICT (entry_number) DO NOTHING
  `;

  // Write ALL sources to trump_sources canonical table
  if (Array.isArray(legacy.sources)) {
    for (const s of legacy.sources) {
      if (!s?.url) continue;
      let publisher = 'unknown';
      try { publisher = new URL(s.url).hostname.replace(/^www\./, ''); } catch { /* skip */ }
      let pubDate = null;
      // Try to extract date from source if available
      await sql`
        INSERT INTO trump_sources (entry_number, url, title, publisher, source_type)
        VALUES (${entryNumber}, ${s.url}, ${s.title ?? legacy.title}, ${publisher}, 'news')
        ON CONFLICT (entry_number, url) DO NOTHING
      `;
    }
  }

  await sql`
    INSERT INTO trump_individual_scores
      (entry_number, danger, authoritarianism, lawlessness, insanity, absurdity, credibility_risk, recency_intensity, impact_scope)
    VALUES (
      ${entryNumber},
      ${legacy.danger},
      ${legacy.authoritarianism},
      ${legacy.lawlessness},
      ${legacy.insanity},
      ${legacy.absurdity},
      ${legacy.credibility_risk ?? 5},
      ${legacy.recency_intensity ?? 5},
      ${legacy.impact_scope ?? 5}
    )
    ON CONFLICT (entry_number) DO NOTHING
  `;
}

// ── Vectorize trigger ─────────────────────────────────────────────────────────

async function triggerVectorize(offset, limit) {
  if (!INGEST_SECRET) {
    console.log('INGEST_SECRET not set, skipping vectorize trigger');
    return;
  }
  const res = await fetch(`${WORKER_URL}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${INGEST_SECRET}`,
    },
    body: JSON.stringify({ offset, limit }),
  });
  const data = await res.json();
  console.log(`Vectorize: ${JSON.stringify(data)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`=== Trump Files Auto-Update [${DRY_RUN ? 'DRY RUN' : 'LIVE'}] ===`);
  console.log(`Date: ${new Date().toISOString()}`);

  const { maxEntry, lastDate } = await getState();
  console.log(`DB state: max entry #${maxEntry}, last date ${lastDate}`);

  console.log('\nResearching via Exa + CF Workers AI (fail-closed)...');
  let candidates;
  try {
    candidates = await researchAndStructure(lastDate, maxEntry);
  } catch (err) {
    console.error('Research failed:', err.message);
    process.exit(1);
  }
  console.log(`Got ${candidates.length} Exa-sourced candidate entries`);

  const valid = [];
  for (const entry of candidates) {
    const errors = validate(entry);
    if (errors.length > 0) {
      console.warn(`SKIP [${entry.title?.slice(0, 40)}]: ${errors.join(', ')}`);
    } else {
      valid.push(entry);
    }
  }
  console.log(`${valid.length} passed validation`);

  if (valid.length === 0) {
    console.log('Nothing to insert. Exiting.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — entries that would be inserted:');
    valid.forEach((e, i) => console.log(`  #${maxEntry + i + 1}: ${e.title}`));
    return;
  }

  console.log('\nInserting...');
  let inserted = 0;
  for (let i = 0; i < valid.length; i++) {
    const num = maxEntry + i + 1;
    try {
      await insertEntry(valid[i], num);
      console.log(`  #${num}: ${valid[i].title.slice(0, 60)}`);
      inserted++;
    } catch (err) {
      console.error(`  FAIL #${num}: ${err.message}`);
    }
  }

  console.log(`\nInserted ${inserted} entries (#${maxEntry + 1}–#${maxEntry + inserted})`);

  if (inserted > 0) {
    // Vectorize using ROW COUNT offset, not entry number
    // Query the actual row count before the new entries to get correct offset
    const [countRow] = await sql`SELECT COUNT(*) as c FROM trump_entries`;
    const totalRows = parseInt(countRow.c, 10);
    const vectorizeOffset = totalRows - inserted; // rows before the new batch
    console.log(`\nTriggering vectorize for ${inserted} new rows (offset=${vectorizeOffset})...`);
    await triggerVectorize(vectorizeOffset, inserted);
  }

  console.log('\n=== Done ===');
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
