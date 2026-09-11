import { buildAugmentedPrompt, dedupeCandidates, materializeRagResult, rerankCandidates, type RagCandidate } from "./rag";

function assert(condition: unknown, message: string): void { if (!condition) throw new Error(message); }

function candidate(overrides: Partial<RagCandidate> = {}): RagCandidate {
  return { key: "entry:1", score: 0.7, entryNumber: 1, context: "Entry #1 | Provenance: no source URL in vector metadata", category: "Government Corruption", dateStart: "2025-01-20", sourceUrls: [], queryIndex: 0, ...overrides };
}

function main(): void {
  const deduped = dedupeCandidates([candidate({ score: .6 }), candidate({ score: .9, sourceUrls: ["https://example.org/source"] })]);
  assert(deduped.length === 1 && deduped[0].score === .9, "dedupe must retain the best entry identity");

  const diversified = rerankCandidates([
    candidate({ key: "entry:1", score: .90, category: "A" }), candidate({ key: "entry:2", entryNumber: 2, score: .89, category: "A" }),
    candidate({ key: "entry:3", entryNumber: 3, score: .88, category: "B" }),
  ], { limit: 2 });
  assert(diversified.map((item) => item.category).includes("B"), "rerank must favor a distinct category when relevance is near equal");

  const sourced = rerankCandidates([candidate({ key: "entry:4", entryNumber: 4, score: .8 }), candidate({ key: "entry:5", entryNumber: 5, score: .78, sourceUrls: ["https://example.org/a"] })], { limit: 1, sourceRequest: true });
  assert(sourced[0].entryNumber === 5, "source requests must prefer candidate metadata with provenance URL");
  const sourcedOnly = rerankCandidates([
    candidate({ key: "entry:6", entryNumber: 6, score: .99 }),
    candidate({ key: "entry:7", entryNumber: 7, score: .70, sourceUrls: ["https://example.org/b"] }),
  ], { limit: 8, sourceRequest: true });
  assert(sourcedOnly.length === 1 && sourcedOnly[0].entryNumber === 7, "source requests must exclude sourceless candidates entirely");

  const result = materializeRagResult(Array.from({ length: 15 }, (_, index) => candidate({ key: `entry:${index}`, entryNumber: index, context: `Entry #${index}`, category: String(index) })));
  assert(result.entryNumbers.length === 12, "final context must cap at 12 entries");

  const prompt = buildAugmentedPrompt("persona", "Entry #1 | Title: fixture");
  assert(prompt.includes("semantic fit and question depth"), "RAG prompt must select evidence by relevance and depth");
  assert(!prompt.includes("2–3 of them"), "RAG prompt must not impose a fixed chip count");
  console.log("verify-rag: ok");
}

main();
