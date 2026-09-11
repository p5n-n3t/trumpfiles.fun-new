import type { RathboneWorldState } from "./rathbone";
import { isRathboneContinuityTurn, isRathboneMention } from "./rathbone";

export type Layer0Intent =
  | "casual/persona"
  | "corpus factual"
  | "current news"
  | "deep thematic"
  | "source request"
  | "follow-up/coreference"
  | "rathbone"
  | "hostile banter";

export type Currentness = "unspecified" | "current" | "historic";
export type RetrievalMode = "none" | "single" | "multi";

export interface ConversationState {
  currentTopic: string;
  entities: string[];
  unresolvedQuestion: string;
  lastChipFact: string;
  lastChipReference: string;
  recentIntents: Layer0Intent[];
  personaContinuity: string;
  updatedTurn: number;
}

export interface RetrievalPlan {
  mode: RetrievalMode;
  topK: number;
  query: string;
  subqueries: string[];
  useExa: boolean;
  querySeed: string;
  rationale: string;
}

export interface TurnRoute {
  intent: Layer0Intent;
  secondaryIntents: Layer0Intent[];
  entities: string[];
  themes: string[];
  timeSignals: string[];
  currentness: Currentness;
  referencesPreviousAnswer: boolean;
  referencesChip: boolean;
  rathboneThread: boolean;
  hostileTone: boolean;
  sourceRequest: boolean;
  questionLike: boolean;
  topicSummary: string;
  retrievalPlan: RetrievalPlan;
  shouldUseExa: boolean;
}

const ENTITY_PATTERNS: Array<{ label: string; aliases: string[] }> = [
  { label: "Trumpstein", aliases: ["trumpstein", "trumpstein ai"] },
  { label: "Trump", aliases: ["trump", "donald trump", "donald j. trump"] },
  { label: "Rathbone", aliases: ["rathbone", "thugbone", "saeedmsr", "martinkrenk", "mood basket", "lolo mcleftie", "squishymellowdragon"] },
  { label: "Hasan Piker", aliases: ["hasan", "hasan piker", "hasanabi"] },
  { label: "Shmuley", aliases: ["shmuley", "boteach"] },
  { label: "Laura Loomer", aliases: ["laura loomer", "loomer"] },
  { label: "Michael Rapaport", aliases: ["michael rapaport", "rapaport"] },
  { label: "Ben Shapiro", aliases: ["ben shapiro", "shapiro"] },
  { label: "Dave Rubin", aliases: ["dave rubin", "rubin"] },
  { label: "Cenk Uygur", aliases: ["cenk uygur", "cenk"] },
  { label: "Krystal Ball", aliases: ["krystal ball", "krystal"] },
  { label: "Owen Jones", aliases: ["owen jones", "owen"] },
  { label: "Tucker Carlson", aliases: ["tucker carlson", "tucker"] },
  { label: "Netanyahu", aliases: ["netanyahu", "bibi"] },
  { label: "Epstein", aliases: ["epstein", "jeffrey epstein"] },
  { label: "Israel", aliases: ["israel", "zionist", "zionism"] },
  { label: "Palestine", aliases: ["palestine", "gaza", "west bank"] },
  { label: "Lebanon", aliases: ["lebanon", "beirut"] },
  { label: "MAGA", aliases: ["maga", "make america great again"] },
  { label: "Workers AI", aliases: ["workers ai", "cloudflare ai", "llama 3.3", "glm-5.2"] },
  { label: "Vectorize", aliases: ["vectorize"] },
  { label: "Exa", aliases: ["exa"] },
];

const THEME_PATTERNS: Array<{ label: string; aliases: string[] }> = [
  { label: "current news", aliases: ["latest", "recent", "current", "breaking", "now", "today", "tonight", "this week", "this month", "this year"] },
  { label: "timeline", aliases: ["timeline", "chronology", "sequence", "when", "dated", "date"] },
  { label: "corruption", aliases: ["corruption", "bribery", "payoff", "payola", "favor", "deal", "money trail"] },
  { label: "authoritarianism", aliases: ["authoritarian", "autocrat", "dictator", "crackdown", "institutions", "power grab"] },
  { label: "legal", aliases: ["indicted", "trial", "court", "lawsuit", "verdict", "appeal", "charges"] },
  { label: "foreign policy", aliases: ["war", "gaza", "iraq", "iran", "ukraine", "foreign policy", "missile", "aid"] },
  { label: "donors", aliases: ["donor", "donors", "campaign finance", "financing"] },
  { label: "family", aliases: ["family", "ivanka", "melania", "don jr", "jared"] },
  { label: "persona", aliases: ["voice", "style", "say it like", "how would you say", "joke", "banter"] },
];

const HOSTILE_PATTERNS = [
  "fuck",
  "shit",
  "bullshit",
  "asshole",
  "bitch",
  "loser",
  "idiot",
  "moron",
  "dumb",
  "stupid",
  "clown",
  "fraud",
];

const SOURCE_PATTERNS = [
  "source",
  "sources",
  "cite",
  "citation",
  "proof",
  "evidence",
  "according to",
  "show me the source",
  "show me sources",
  "show me evidence",
  "show me proof",
  "show me citations",
  "show me a link",
  "where did",
  "who says",
  "is this real",
  "real or fake",
  "real or fiction",
];

const CHIP_REFERENCE_PATTERNS = [
  "what did the chip say",
  "what did it just say",
  "that chip",
  "that override",
  "previous answer",
  "what did you say earlier",
  "as you said",
  "you said",
  "what about that",
];

const FOLLOW_UP_PATTERNS = [
  "what about",
  "and then",
  "and that",
  "same room",
  "same thread",
  "more on",
  "tell me more",
  "follow up",
  "earlier",
  "again",
  "it",
  "that",
  "they",
  "he",
  "she",
];

const CURRENTNESS_PATTERNS = [
  "latest",
  "recent",
  "current",
  "now",
  "breaking",
  "today",
  "this week",
  "this month",
  "this year",
  "tonight",
  "just happened",
  "announced",
  "happening",
];

export class Layer0TurnRouter {
  routeTurn(
    message: string,
    history: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    conversationState: ConversationState,
    rathboneState: RathboneWorldState
  ): TurnRoute {
    const normalized = normalizeText(message);
    const entities = extractEntities(message);
    const themes = extractThemes(message);
    const timeSignals = extractTimeSignals(normalized);
    const sourceRequest = hasAny(normalized, SOURCE_PATTERNS);
    const previousAssistant = [...history].reverse().find((entry) => entry.role === "assistant")?.content ?? "";
    const previousAssistantNormalized = normalizeText(previousAssistant);
    const previousAssistantChip = extractChip(previousAssistant);
    const hasPriorContext = Boolean(
      previousAssistantNormalized ||
      conversationState.currentTopic ||
      conversationState.lastChipFact ||
      conversationState.unresolvedQuestion
    );
    const referencesChip = hasAny(normalized, CHIP_REFERENCE_PATTERNS) || Boolean(previousAssistantChip.fact && hasAny(normalized, ["what did you say", "what was the chip", "that chip", "the chip"]));
    const referencesPreviousAnswer = referencesChip || hasAny(normalized, FOLLOW_UP_PATTERNS) || (previousAssistantNormalized.length > 0 && hasAny(normalized, ["you said", "as you said", "earlier", "above", "again"]));
    const hostileTone = scoreHostility(normalized) >= 2;
    const questionLike = message.trim().endsWith("?") || /^\s*(what|why|how|who|when|where|which|can|could|would|should|is|are|do|does|did)\b/i.test(message);
    const currentness = hasAny(normalized, CURRENTNESS_PATTERNS) ? "current" : looksHistorical(normalized) ? "historic" : "unspecified";
    const rathboneThread = isRathboneMention(normalized) || isRathboneContinuityTurn(rathboneState, message);
    const deepThematic = isDeepThematic(message, entities, themes, referencesPreviousAnswer);
    const currentNews = currentness === "current" && (sourceRequest || hasAny(normalized, ["news", "happening", "breaking", "what happened", "what is going on", "updates"]));
    const intent = resolveIntent({
      sourceRequest,
      hostileTone,
      rathboneThread,
      deepThematic,
      currentNews,
      referencesPreviousAnswer,
      hasPriorContext,
      entities,
      themes,
      questionLike,
      message,
      conversationState,
    });
    const retrievalPlan = buildRetrievalPlan(intent, message, entities, themes, currentness, referencesPreviousAnswer, conversationState);
    const shouldUseExa = decideExaUsage(intent, currentness, sourceRequest, deepThematic, referencesPreviousAnswer, entities, themes);
    const primaryTopic = chooseTopicSummary(entities, themes, conversationState, message);
    const secondaryIntents = buildSecondaryIntents(intent, sourceRequest, hostileTone, currentNews, deepThematic, referencesPreviousAnswer, rathboneThread);

    return {
      intent,
      secondaryIntents,
      entities,
      themes,
      timeSignals,
      currentness,
      referencesPreviousAnswer,
      referencesChip,
      rathboneThread,
      hostileTone,
      sourceRequest,
      questionLike,
      topicSummary: primaryTopic,
      retrievalPlan: {
        ...retrievalPlan,
        useExa: shouldUseExa,
        querySeed: primaryTopic,
      },
      shouldUseExa,
    };
  }
}

export function createDefaultConversationState(): ConversationState {
  return {
    currentTopic: "",
    entities: [],
    unresolvedQuestion: "",
    lastChipFact: "",
    lastChipReference: "",
    recentIntents: [],
    personaContinuity: "default",
    updatedTurn: 0,
  };
}

export function normalizeConversationState(raw: unknown): ConversationState {
  const base = createDefaultConversationState();
  if (!raw || typeof raw !== "object") return base;
  const parsed = raw as Partial<ConversationState>;
  return {
    currentTopic: cleanText(parsed.currentTopic, 96),
    entities: normalizeList(parsed.entities, 6),
    unresolvedQuestion: cleanText(parsed.unresolvedQuestion, 180),
    lastChipFact: cleanText(parsed.lastChipFact, 180),
    lastChipReference: cleanText(parsed.lastChipReference, 80),
    recentIntents: normalizeIntentList(parsed.recentIntents, 5),
    personaContinuity: cleanText(parsed.personaContinuity, 48) || "default",
    updatedTurn: positiveInt(parsed.updatedTurn),
  };
}

export function applyUserTurnConversationState(
  current: ConversationState,
  route: TurnRoute,
  priorHistory: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  message: string,
  currentTurn: number
): ConversationState {
  const lastAssistant = [...priorHistory].reverse().find((entry) => entry.role === "assistant")?.content ?? "";
  const chip = extractChip(lastAssistant);
  const nextEntities = mergeUnique(current.entities, route.entities, 6);
  const topic = route.topicSummary || current.currentTopic || nextEntities[0] || "";
  const personaContinuity = route.hostileTone ? "hostile" : route.intent === "casual/persona" ? "casual" : route.intent;

  return {
    currentTopic: topic,
    entities: nextEntities,
    unresolvedQuestion: route.questionLike ? cleanText(message, 180) : current.unresolvedQuestion,
    lastChipFact: chip.fact || current.lastChipFact,
    lastChipReference: chip.reference || current.lastChipReference,
    recentIntents: pushBounded(current.recentIntents, route.intent, 5),
    personaContinuity,
    updatedTurn: currentTurn,
  };
}

export function finalizeAssistantConversationState(
  current: ConversationState,
  assistantText: string
): ConversationState {
  const chip = extractChip(assistantText);
  return {
    ...current,
    unresolvedQuestion: "",
    lastChipFact: chip.fact || current.lastChipFact,
    lastChipReference: chip.reference || current.lastChipReference,
  };
}

export function buildConversationStatePrompt(state: ConversationState): string {
  const lines = [
    `Current topic: ${state.currentTopic || "none"}`,
    `Entities: ${state.entities.length ? state.entities.join(", ") : "none"}`,
    `Unresolved question: ${state.unresolvedQuestion || "none"}`,
    `Last chip fact: ${state.lastChipFact || "none"}`,
    `Last chip reference: ${state.lastChipReference || "none"}`,
    `Recent intents: ${state.recentIntents.length ? state.recentIntents.join(" > ") : "none"}`,
    `Persona continuity: ${state.personaContinuity}`,
  ];
  return lines.join("; ");
}

export function buildRetrievalPlan(
  intent: Layer0Intent,
  message: string,
  entities: string[],
  themes: string[],
  currentness: Currentness,
  referencesPreviousAnswer: boolean,
  conversationState: ConversationState
): RetrievalPlan {
  const querySeed = chooseTopicSummary(entities, themes, conversationState, message);
  if (intent === "casual/persona") {
    return {
      mode: "none",
      topK: 0,
      query: querySeed || message,
      subqueries: [],
      useExa: false,
      querySeed,
      rationale: "persona/casual turn",
    };
  }

  if (intent === "hostile banter") {
    return {
      mode: "none",
      topK: 0,
      query: querySeed || message,
      subqueries: [],
      useExa: false,
      querySeed,
      rationale: "hostile banter gets zero/low retrieval",
    };
  }

  if (intent === "deep thematic") {
    const subqueries = buildDeepThemeSubqueries(message, entities, themes, conversationState);
    return {
      mode: "multi",
      topK: 4,
      query: querySeed || message,
      subqueries,
      useExa: currentness === "current",
      querySeed,
      rationale: "multi-subquery deep thematic retrieval",
    };
  }

  const simpleTopK = intent === "source request" ? 6 : intent === "follow-up/coreference" ? (referencesPreviousAnswer ? 3 : 5) : 5;
  return {
    mode: "single",
    topK: simpleTopK,
    query: buildSingleQuery(message, querySeed, entities, themes, referencesPreviousAnswer, conversationState),
    subqueries: [],
    useExa: currentness === "current" || intent === "current news",
    querySeed,
    rationale: intent === "current news" ? "current news/simple factual hybrid" : "single-query factual fallback",
  };
}

export function decideExaUsage(
  intent: Layer0Intent,
  currentness: Currentness,
  sourceRequest: boolean,
  deepThematic: boolean,
  referencesPreviousAnswer: boolean,
  entities: string[],
  themes: string[]
): boolean {
  if (currentness === "current") return true;
  if (intent === "current news") return true;
  if (sourceRequest && currentness !== "historic") return true;
  if (deepThematic && (entities.length > 0 || themes.some((theme) => /current|news|war|israel|gaza|epstein/i.test(theme)))) return true;
  if (referencesPreviousAnswer && intent === "follow-up/coreference" && currentness !== "historic") return true;
  return false;
}

function resolveIntent(input: {
  sourceRequest: boolean;
  hostileTone: boolean;
  rathboneThread: boolean;
  deepThematic: boolean;
  currentNews: boolean;
  referencesPreviousAnswer: boolean;
  hasPriorContext: boolean;
  entities: string[];
  themes: string[];
  questionLike: boolean;
  message: string;
  conversationState: ConversationState;
}): Layer0Intent {
  const normalized = normalizeText(input.message);

  if (input.rathboneThread && !input.sourceRequest && !looksRealityBoundary(normalized)) return "rathbone";
  if (input.sourceRequest) return "source request";
  if (input.currentNews) return "current news";
  if (input.deepThematic) return "deep thematic";
  if (input.referencesPreviousAnswer && input.hasPriorContext) return "follow-up/coreference";
  if (input.hostileTone && !input.entities.length && !input.themes.length) return "hostile banter";
  if (input.questionLike && (input.entities.length > 0 || input.themes.length > 0)) return "corpus factual";
  if (hasPersonaModeCue(normalized)) return "casual/persona";
  if (input.entities.length === 0 && input.themes.length === 0 && !input.questionLike) return "casual/persona";
  return "corpus factual";
}

function buildSecondaryIntents(
  primary: Layer0Intent,
  sourceRequest: boolean,
  hostileTone: boolean,
  currentNews: boolean,
  deepThematic: boolean,
  referencesPreviousAnswer: boolean,
  rathboneThread: boolean
): Layer0Intent[] {
  const extras: Layer0Intent[] = [];
  if (sourceRequest && primary !== "source request") extras.push("source request");
  if (hostileTone && primary !== "hostile banter") extras.push("hostile banter");
  if (currentNews && primary !== "current news") extras.push("current news");
  if (deepThematic && primary !== "deep thematic") extras.push("deep thematic");
  if (referencesPreviousAnswer && primary !== "follow-up/coreference") extras.push("follow-up/coreference");
  if (rathboneThread && primary !== "rathbone") extras.push("rathbone");
  return extras.slice(0, 3);
}

function buildSingleQuery(
  message: string,
  querySeed: string,
  entities: string[],
  themes: string[],
  referencesPreviousAnswer: boolean,
  conversationState: ConversationState
): string {
  // Preserve the user's actual terms. `querySeed` is a compact continuity hint
  // (often just an entity such as "Trump"), not a substitute for the question.
  const parts = [message, querySeed];
  if (entities.length > 0) parts.push(entities.slice(0, 3).join(" "));
  if (themes.length > 0) parts.push(themes.slice(0, 3).join(" "));
  if (referencesPreviousAnswer && conversationState.currentTopic) parts.push(conversationState.currentTopic);
  return uniqueWords(parts.join(" ")).slice(0, 240);
}

function buildDeepThemeSubqueries(
  message: string,
  entities: string[],
  themes: string[],
  state: ConversationState
): string[] {
  const base = uniqueWords(message);
  const topic = chooseTopicSummary(entities, themes, state, message);
  const seeds = [
    base,
    topic ? `${topic} chronology` : "",
    entities.length > 0 ? `${entities[0]} timeline context` : "",
    themes.length > 0 ? `${themes[0]} evidence chronology` : "",
    state.currentTopic ? `${state.currentTopic} follow-up context` : "",
  ];
  const out = seeds.filter((s, index, arr) => s && arr.indexOf(s) === index).slice(0, 4);
  return out;
}

function chooseTopicSummary(
  entities: string[],
  themes: string[],
  state: ConversationState,
  message: string
): string {
  if (entities.length > 0) return entities[0];
  if (themes.length > 0) return themes[0];
  if (state.currentTopic) return state.currentTopic;
  return uniqueWords(message).slice(0, 80);
}

function extractEntities(message: string): string[] {
  const normalized = normalizeText(message);
  const entities: string[] = [];
  for (const entry of ENTITY_PATTERNS) {
    if (entry.aliases.some((alias) => normalized.includes(alias))) {
      entities.push(entry.label);
    }
  }
  for (const match of message.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)) {
    const candidate = match[1].trim();
    if (!candidate || isStopPhrase(candidate)) continue;
    if (!entities.includes(candidate)) entities.push(candidate);
  }
  return entities.slice(0, 8);
}

function extractThemes(message: string): string[] {
  const normalized = normalizeText(message);
  const themes: string[] = [];
  for (const entry of THEME_PATTERNS) {
    if (entry.aliases.some((alias) => normalized.includes(alias))) {
      themes.push(entry.label);
    }
  }
  if (hasAny(normalized, ["why", "how", "explain", "analyze", "compare", "pattern", "throughline", "relationship"])) {
    themes.push("analysis");
  }
  if (hasAny(normalized, ["who", "what", "when", "where", "why", "how"])) {
    themes.push("question");
  }
  return normalizeList(themes, 6);
}

function extractTimeSignals(normalized: string): string[] {
  const signals: string[] = [];
  if (hasAny(normalized, ["today", "tonight", "now", "breaking", "latest", "current", "recent"])) signals.push("current");
  if (hasAny(normalized, ["2025", "2026", "this year", "this month", "this week"])) signals.push("recent");
  if (hasAny(normalized, ["yesterday", "last week", "last month", "last year", "historically", "back then"])) signals.push("historic");
  if (/\b\d{4}\b/.test(normalized)) signals.push("date");
  return normalizeList(signals, 4);
}

function scoreHostility(normalized: string): number {
  let score = 0;
  for (const cue of HOSTILE_PATTERNS) {
    if (normalized.includes(cue)) score += 1;
  }
  return score;
}

function isDeepThematic(
  message: string,
  entities: string[],
  themes: string[],
  referencesPreviousAnswer: boolean
): boolean {
  const normalized = normalizeText(message);
  if (message.length > 180) return true;
  if (entities.length >= 2 || themes.length >= 2) return true;
  if (hasAny(normalized, ["deep dive", "throughline", "pattern", "compare", "relationship", "why does", "how does", "bigger picture", "thematic"])) return true;
  if (referencesPreviousAnswer && hasAny(normalized, ["why", "how", "what does that mean", "what is the pattern"])) return true;
  return false;
}

function hasPersonaModeCue(normalized: string): boolean {
  return hasAny(normalized, ["who are you", "how should you talk", "talk like", "say it like trump", "be trump", "persona", "banter", "joke", "small talk", "roast yourself", "roast me"]);
}

function looksHistorical(normalized: string): boolean {
  return hasAny(normalized, ["history", "historical", "back then", "previously", "before", "in 2016", "in 2020", "in 2024", "in 2025"]);
}

function looksRealityBoundary(normalized: string): boolean {
  return hasAny(normalized, ["is this real", "real or fake", "real or fiction", "is that true", "actual fact", "what is real"]);
}

function extractChip(text: string): { fact: string; reference: string } {
  const chipMatch = text.match(/\[CHIP OVERRIDE:\s*([^\]]+)\]/i);
  if (!chipMatch) return { fact: "", reference: "" };
  const payload = cleanText(chipMatch[1], 180);
  const refMatch = payload.match(/Entry #\d+/i) || payload.match(/https?:\/\/\S+/i);
  return {
    fact: payload,
    reference: refMatch?.[0] ?? "",
  };
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanText(text: string | undefined, maxLen: number): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeList(values: string[] | undefined, limit: number): string[] {
  const out: string[] = [];
  if (!Array.isArray(values)) return out;
  for (const value of values) {
    const cleaned = cleanText(value, 64).toLowerCase();
    if (!cleaned || out.includes(cleaned)) continue;
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
}

function positiveInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeIntentList(values: Layer0Intent[] | undefined, limit: number): Layer0Intent[] {
  if (!Array.isArray(values)) return [];
  const out: Layer0Intent[] = [];
  for (const value of values) {
    if (!out.includes(value)) out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function pushBounded(list: Layer0Intent[], value: Layer0Intent, limit: number): Layer0Intent[] {
  const out = [value, ...list.filter((item) => item !== value)];
  return out.slice(0, limit);
}

function mergeUnique(primary: string[], additions: string[], limit: number): string[] {
  const merged: string[] = [];
  for (const item of [...additions, ...primary]) {
    const cleaned = cleanText(item, 64);
    if (!cleaned || merged.includes(cleaned)) continue;
    merged.push(cleaned);
    if (merged.length >= limit) break;
  }
  return merged;
}

function hasAny(text: string, cues: string[]): boolean {
  return cues.some((cue) => matchesCue(text, cue));
}

function matchesCue(text: string, cue: string): boolean {
  const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
}

function isStopPhrase(candidate: string): boolean {
  return [
    "what",
    "tell",
    "give",
    "ask",
    "why",
    "how",
    "when",
    "where",
    "who",
    "you",
    "your",
    "yourself",
    "me",
    "my",
    "i",
    "current",
    "recent",
    "latest",
    "today",
    "trump",
    "this",
    "that",
    "the",
    "and",
    "or",
  ].includes(candidate.toLowerCase());
}

function uniqueWords(value: string): string {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out.join(" ");
}
