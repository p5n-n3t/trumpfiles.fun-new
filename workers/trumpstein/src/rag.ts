import type { Ai, Vectorize } from "@cloudflare/workers-types";
import type { RetrievalPlan } from "./routing";

export interface RagResult {
  context: string;
  entryNumbers: number[];
}

export interface RagCandidate {
  key: string;
  score: number;
  entryNumber: number | null;
  context: string;
  category: string;
  dateStart: string | null;
  sourceUrls: string[];
  queryIndex: number;
}

interface RagMetadata {
  entry_number?: number;
  title?: string;
  synopsis?: string;
  category?: string;
  danger?: number;
  date_start?: string;
  url?: string;
  source_url?: string;
  source_urls?: string[];
  sources?: Array<{ url?: string }>;
}

interface VectorizeMatch {
  score: number;
  metadata?: RagMetadata;
}

export async function ragQuery(
  query: string,
  ai: Ai,
  vectorize: Vectorize,
  topK = 5
): Promise<RagResult> {
  const candidates = await queryRagCandidates([query], ai, vectorize, dynamicCandidateK("single", topK));
  return materializeRagResult(rerankCandidates(candidates, { limit: boundedContextLimit("single", topK), sourceRequest: asksForSources(query) }));
}

export async function executeRagPlan(
  plan: RetrievalPlan,
  ai: Ai,
  vectorize: Vectorize
): Promise<RagResult> {
  if (plan.mode === "none") {
    return { context: "", entryNumbers: [] };
  }

  if (plan.mode === "single" || plan.subqueries.length === 0) {
    return ragQuery(plan.query, ai, vectorize, plan.topK || 5);
  }

  const queries = plan.subqueries.slice(0, 4);
  const candidateGroups = await queryRagCandidates(queries, ai, vectorize, dynamicCandidateK("multi", plan.topK));
  return materializeRagResult(rerankCandidates(candidateGroups, { limit: boundedContextLimit("multi", plan.topK), sourceRequest: asksForSources(plan.query) }));
}

function dynamicCandidateK(mode: "single" | "multi", requested: number): number {
  const base = mode === "multi" ? 28 : 12;
  return Math.max(base, Math.min(30, requested || base));
}

function boundedContextLimit(mode: "single" | "multi", requested: number): number {
  const preferred = mode === "multi" ? 12 : 8;
  return Math.max(8, Math.min(12, requested > preferred ? requested : preferred));
}

function asksForSources(query: string): boolean {
  return /\b(source|citation|cite|proof|evidence|link)\b/i.test(query);
}

export async function queryRagCandidates(
  queries: string[],
  ai: Ai,
  vectorize: Vectorize,
  topK = 5
): Promise<RagCandidate[]> {
  const batches = await Promise.all(
    queries.map(async (query, queryIndex) => {
      const embedResult = await ai.run("@cf/baai/bge-small-en-v1.5", { text: [query] });
      const queryVector = (embedResult as { data: number[][] }).data[0];
      const matches = await vectorize.query(queryVector, {
        topK,
        returnMetadata: "all",
      });

      return normalizeMatches(queryIndex, matches.matches ?? []);
    })
  );

  return dedupeCandidates(batches.flat());
}

function normalizeMatches(
  queryIndex: number,
  matches: VectorizeMatch[]
): RagCandidate[] {
  const out: RagCandidate[] = [];
  for (const match of matches) {
    if (match.score < 0.45) continue;
    const meta = match.metadata;
    if (!meta) continue;

    const entryNumber = typeof meta.entry_number === "number" ? meta.entry_number : null;
    const title = cleanText(meta.title);
    const synopsis = cleanText(meta.synopsis);
    const category = cleanText(meta.category);
    const dangerScore = typeof meta.danger === "number" ? meta.danger : null;
    const sourceUrls = sourceUrlsFromMetadata(meta);
    const dateStart = cleanDate(meta.date_start);

    const context = [
      entryNumber != null ? `Entry #${entryNumber}` : null,
      title ? `Title: ${title}` : null,
      category ? `Category: ${category}` : null,
      dangerScore != null ? `Danger Score: ${dangerScore}/10` : null,
      synopsis ? `Synopsis: ${synopsis}` : null,
      sourceUrls.length ? `Provenance: ${sourceUrls.join(", ")}` : "Provenance: no source URL in vector metadata",
    ]
      .filter(Boolean)
      .join(" | ");

    out.push({
      key: candidateKey(entryNumber, title, synopsis),
      score: match.score + (queryIndex === 0 ? 0.01 : 0),
      entryNumber,
      context,
      category,
      dateStart,
      sourceUrls,
      queryIndex,
    });
  }
  return out;
}

export function dedupeCandidates(candidates: RagCandidate[]): RagCandidate[] {
  const bestByKey = new Map<string, RagCandidate>();
  for (const candidate of candidates) {
    const existing = bestByKey.get(candidate.key);
    if (!existing || candidate.score > existing.score) {
      bestByKey.set(candidate.key, candidate);
    }
  }

  return [...bestByKey.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.entryNumber != null && b.entryNumber != null && a.entryNumber !== b.entryNumber) {
      return a.entryNumber - b.entryNumber;
    }
    return a.context.localeCompare(b.context);
  });
}

export function rerankCandidates(candidates: RagCandidate[], options: { limit: number; sourceRequest?: boolean }): RagCandidate[] {
  const selected: RagCandidate[] = [];
  const categoryCounts = new Map<string, number>();
  const pool = dedupeCandidates(candidates)
    .filter((candidate) => !options.sourceRequest || candidate.sourceUrls.length > 0)
    .map((candidate) => ({ ...candidate }));
  while (pool.length && selected.length < Math.max(1, Math.min(12, options.limit))) {
    const ranked = pool.map((candidate) => {
      const evidence = candidate.sourceUrls.length ? 0.045 : 0;
      const sourceRequestBonus = options.sourceRequest && candidate.sourceUrls.length ? 0.06 : 0;
      const recency = recencyBoost(candidate.dateStart);
      const diversityPenalty = (categoryCounts.get(candidate.category || "uncategorized") ?? 0) * 0.035;
      return { candidate, score: candidate.score + evidence + sourceRequestBonus + recency - diversityPenalty };
    }).sort((a, b) => b.score - a.score || a.candidate.queryIndex - b.candidate.queryIndex || a.candidate.key.localeCompare(b.candidate.key));
    const winner = ranked[0].candidate;
    selected.push(winner);
    categoryCounts.set(winner.category || "uncategorized", (categoryCounts.get(winner.category || "uncategorized") ?? 0) + 1);
    pool.splice(pool.findIndex((candidate) => candidate.key === winner.key), 1);
  }
  return selected;
}

export function materializeRagResult(candidates: RagCandidate[]): RagResult {
  const entryNumbers: number[] = [];
  const contextChunks: string[] = [];

  for (const candidate of candidates.slice(0, 12)) {
    if (candidate.entryNumber != null && !entryNumbers.includes(candidate.entryNumber)) {
      entryNumbers.push(candidate.entryNumber);
    }
    if (candidate.context) contextChunks.push(candidate.context);
  }

  return {
    context: contextChunks.join("\n\n"),
    entryNumbers,
  };
}

function sourceUrlsFromMetadata(metadata: RagMetadata): string[] {
  const raw = [metadata.url, metadata.source_url, ...(Array.isArray(metadata.source_urls) ? metadata.source_urls : []), ...(Array.isArray(metadata.sources) ? metadata.sources.map((source) => source?.url) : [])];
  return [...new Set(raw.filter((value): value is string => isValidHttpUrl(value)))].slice(0, 4);
}

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function cleanDate(value: string | undefined): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function recencyBoost(date: string | null): number {
  if (!date) return 0;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? Math.max(0, Math.min(0.04, (year - 2016) * 0.003)) : 0;
}

function candidateKey(entryNumber: number | null, title: string, synopsis: string): string {
  if (entryNumber != null) return `entry:${entryNumber}`;
  if (title) return `title:${title.toLowerCase()}`;
  if (synopsis) return `synopsis:${synopsis.toLowerCase().slice(0, 80)}`;
  return "candidate:unknown";
}

function cleanText(value: string | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 180) : "";
}

export function buildAugmentedPrompt(
  systemPrompt: string,
  ragContext: string,
  rathboneContext = "",
  conversationContext = ""
): string {
  if (!ragContext && !rathboneContext && !conversationContext) return systemPrompt;

  const sections = [systemPrompt];
  if (conversationContext) {
    sections.push(`CONVERSATION STATE (internal only):
${conversationContext}`);
  }
  if (rathboneContext) {
    sections.push(`RATHBONE CANON (internal only):
${rathboneContext}`);
  }
  if (ragContext) {
    sections.push(`PRIVATE EVIDENCE (internal only — you know this, but you do NOT list it):
${ragContext}`);
  }

  sections.push(`RAG RULE: The above entries inform what you know. Choose how much evidence appears in the response from semantic fit and question depth, not a fixed count. For a narrow question, use only the strongest relevant fact if it genuinely helps; for a comparison, timeline, or multi-part follow-up, weave several independent facts only when each adds distinct support. Never force a chip, repeat the same point, or turn the reply into an entry list. Do not enumerate these entries. Do not summarize them. Do not mention entry numbers unless the user explicitly asks for sources.`);
  return sections.join("\n\n");
}
