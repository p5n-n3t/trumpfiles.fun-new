export type RathboneStage = 0 | 1 | 2 | 3;

export interface ChatLikeMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RathboneWorldState {
  stage: RathboneStage;
  active: boolean;
  topicContinuityScore: number;
  relevantTurnCount: number;
  lastRelevantTurn: number;
  activeThemes: string[];
  charactersRecentlyUsed: string[];
  jokeContinuity: string[];
  fictionalEventContinuity: string[];
  missedTurns: number;
}

export interface RathboneUpdateInput {
  message: string;
  history: ChatLikeMessage[];
  currentTurn: number;
}

export interface RathboneUpdateResult {
  state: RathboneWorldState;
  promptAugmentation: string;
  relevant: boolean;
}

export interface RathboneCastCard {
  key: string;
  label: string;
  blurb: string;
}

export interface RathboneAssistantCanon {
  characters: string[];
  events: string[];
  callbacks: string[];
}

const MAX_THEMES = 6;
const MAX_CHARACTERS = 6;
const MAX_JOKES = 4;
const MAX_EVENTS = 3;
const MAX_ASSISTANT_CANON_ITEMS = 2;
const MAX_STAGE_2_CARDS = 1;
const MAX_STAGE_3_CARDS = 3;

const RATHBONE_ALIASES = [
  "rathbone",
  "thugbone",
  "saeedmsr",
  "martinkrenk",
  "mood basket",
  "lolomcleftie",
  "lolo mcleftie",
  "squishymellowdragon",
];

const CORE_KEYWORDS = [
  "new orleans",
  "musician",
  "streamer",
  "youtube",
  "twitch",
  "anti-israel",
  "anti capitalist",
  "anti-capitalist",
  "pro palestine",
  "pro-palestine",
  "pro lebanon",
  "pro-lebanon",
  "global south",
  "rivalry",
  "jealous",
  "affection",
  "trumpstein",
];

const STAGE_2_KEYWORDS = [
  "rivalry history",
  "community",
  "chat",
  "same room",
  "what would happen",
  "compare me",
];

const STAGE_3_CHARACTERS = [
  "shmuley",
  "rapaport",
  "shapiro",
  "rubin",
  "loomer",
  "hasan",
  "cenk",
  "krystal",
  "owen",
  "tucker",
];

const CAST_LIBRARY: Array<{
  key: string;
  label: string;
  aliases: string[];
  stageBias: 2 | 3;
  blurb: string;
  topicHints: string[];
  wildcard?: boolean;
}> = [
  {
    key: "shmuley",
    label: "Shmuley",
    aliases: ["shmuley", "boteach"],
    stageBias: 3,
    blurb: "Celebrity rabbi/media personality; mock the branding, airtime, and grandstanding, not Jewish identity. No fake misconduct.",
    topicHints: ["israel", "media", "debate", "rabbi", "podcast", "television", "showman", "branding"],
  },
  {
    key: "loomer",
    label: "Loomer",
    aliases: ["loomer", "laura loomer"],
    stageBias: 3,
    blurb: "Online provocateur and chaos agent; useful as a combustible media foil. No fake crimes or misconduct.",
    topicHints: ["media", "provocateur", "chaos", "right wing", "online"],
  },
  {
    key: "rapaport",
    label: "Rapaport",
    aliases: ["rapaport", "michael rapaport"],
    stageBias: 3,
    blurb: "Loud actor/comedian/podcaster; a theatrical pro-Israel foil with lots of yelling and little discipline.",
    topicHints: ["israel", "media", "actor", "comedian", "podcast", "loud", "Hollywood"],
  },
  {
    key: "shapiro",
    label: "Ben Shapiro",
    aliases: ["shapiro", "ben shapiro"],
    stageBias: 3,
    blurb: "Fast-talking pundit and debate machine; can be the relentless pro-Israel logic hammer in the room.",
    topicHints: ["israel", "debate", "media", "pundit", "facts", "logic"],
  },
  {
    key: "rubin",
    label: "Dave Rubin",
    aliases: ["rubin", "dave rubin"],
    stageBias: 3,
    blurb: "Podcast/media brand operator; soft-spoken contrarian energy with pro-Israel alignment.",
    topicHints: ["media", "podcast", "youtube", "brand", "israel", "commentary"],
  },
  {
    key: "hasan",
    label: "Hasan Piker",
    aliases: ["hasan", "hasan piker", "hasanabi"],
    stageBias: 3,
    blurb: "Giant left-wing streamer and anti-Zionist megaphone; fictional co-belligerent on Palestine/anti-war threads.",
    topicHints: ["palestine", "anti-zionist", "anti war", "streamer", "twitch", "youtube", "global south"],
  },
  {
    key: "cenk",
    label: "Cenk Uygur",
    aliases: ["cenk", "cenk uygur"],
    stageBias: 3,
    blurb: "Loud anti-war commentator; can amplify the anti-Israel media orbit without becoming a fixed ally.",
    topicHints: ["palestine", "anti war", "media", "commentator", "israel", "gaza"],
  },
  {
    key: "krystal",
    label: "Krystal Ball",
    aliases: ["krystal", "krystal ball"],
    stageBias: 3,
    blurb: "Sharp interviewer/commentator; pins down war-policy specifics and forces details.",
    topicHints: ["palestine", "interview", "war", "media", "gaza", "policy"],
  },
  {
    key: "owen",
    label: "Owen Jones",
    aliases: ["owen", "owen jones"],
    stageBias: 3,
    blurb: "Outspoken critic of Netanyahu and Gaza policy; useful as a sharp foreign commentary edge.",
    topicHints: ["palestine", "gaza", "netanyahu", "media", "critic", "british"],
  },
  {
    key: "tucker",
    label: "Tucker Carlson",
    aliases: ["tucker", "tucker carlson"],
    stageBias: 3,
    blurb: "Wildcard third force: anti-interventionist, opportunistic, and capable of pivoting between sides.",
    topicHints: ["anti war", "intervention", "war", "media", "wildcard", "third force", "establishment"],
    wildcard: true,
  },
];

const FOLLOW_UP_CUES = [
  "what about",
  "what if",
  "and then",
  "and that",
  "same room",
  "again",
  "too",
  "also",
  "that guy",
  "that woman",
  "he",
  "him",
  "they",
  "this",
  "that",
];

const RATHBONE_STAGE_1_PROMPT = [
  "Rathbone canon is active only for this thread.",
  "Keep it fictional and satirical.",
  "Small core only: Rathbone is the New Orleans musician / political streamer on YouTube and Twitch.",
  "He is Trumpstein's ideological opposite: anti-Israel, anti-capitalist, pro-Palestine, pro-Lebanon, and pro-Global-South, per the owner's canon.",
  "Trumpstein's default relation is rivalry, jealousy, and secret affection.",
  "Do not dump the wider cast yet.",
].join(" ");

const RATHBONE_STAGE_2_PROMPT = [
  "Stage 2: the thread is still alive, so you may add a little more.",
  "You can mention rivalry history, Trumpstein comparing the user to Rathbone, or one adjacent figure if it is truly organic.",
  "Use Rathbone community names sparingly.",
  "Do not explode into the full roster.",
].join(" ");

const RATHBONE_STAGE_3_PROMPT = [
  "Stage 3: the conversation has stayed on the Rathbone / Israel / media / rivalry track.",
  "You may draw selectively from the larger fictional world, but keep it conversational and compact.",
  "One new recurring character or one callback is enough.",
  "Never present the invented relationships as real-world facts.",
].join(" ");

const RATHBONE_FICTION_GUARD = [
  "Fiction guard: never let Rathbone canon leak into factual archive, RAG, SEO, Insights, source metadata, or claims about real people's actual relationships.",
  "On a Rathbone canon turn, never emit a [CHIP OVERRIDE], an entry number, a source citation, or an invented biographical metric as though it were documented fact.",
  "Do not invent subscriber counts, career history, real meetings, crimes, quotes, or public conduct. Keep relationship beats and incidents explicitly in-universe satire.",
  "If the user asks for real-world facts, separate them from the fictional thread.",
  "Shmuley satire must target celebrity/media persona and public advocacy, not Jewish identity; do not invent crimes or misconduct.",
  "Public politics only seed characterization; keep invented relationships clearly fictional.",
].join(" ");

export function createDormantRathboneWorldState(): RathboneWorldState {
  return {
    stage: 0,
    active: false,
    topicContinuityScore: 0,
    relevantTurnCount: 0,
    lastRelevantTurn: 0,
    activeThemes: [],
    charactersRecentlyUsed: [],
    jokeContinuity: [],
    fictionalEventContinuity: [],
    missedTurns: 0,
  };
}

export function parseRathboneWorldState(raw: string | null | undefined): RathboneWorldState {
  if (!raw) return createDormantRathboneWorldState();
  try {
    const parsed = JSON.parse(raw) as Partial<RathboneWorldState>;
    return {
      ...createDormantRathboneWorldState(),
      ...parsed,
      stage: normalizeStage(parsed.stage),
      active: typeof parsed.active === "boolean" ? parsed.active : parsed.stage ? parsed.stage > 0 : false,
      topicContinuityScore: clamp01(parsed.topicContinuityScore),
      relevantTurnCount: positiveInt(parsed.relevantTurnCount),
      lastRelevantTurn: positiveInt(parsed.lastRelevantTurn),
      activeThemes: normalizeList(parsed.activeThemes, MAX_THEMES),
      charactersRecentlyUsed: normalizeList(parsed.charactersRecentlyUsed, MAX_CHARACTERS),
      jokeContinuity: normalizeList(parsed.jokeContinuity, MAX_JOKES),
      fictionalEventContinuity: normalizeList(parsed.fictionalEventContinuity, MAX_EVENTS),
      missedTurns: positiveInt(parsed.missedTurns),
    };
  } catch {
    return createDormantRathboneWorldState();
  }
}

export function serializeRathboneWorldState(state: RathboneWorldState): string {
  return JSON.stringify(state);
}

export function isRathboneMention(text: string): boolean {
  const normalized = normalizeText(text);
  return RATHBONE_ALIASES.some((alias) => normalized.includes(alias)) ||
    normalized.split(" ").some(isRathboneTypo);
}

function isRathboneTypo(token: string): boolean {
  if (token.length < 6 || token.length > 10) return false;
  return levenshteinDistance(token, "rathbone") <= 2;
}

function levenshteinDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function updateRathboneWorldState(
  previous: RathboneWorldState,
  input: RathboneUpdateInput
): RathboneUpdateResult {
  const normalizedMessage = normalizeText(input.message);
  const recentWindow = input.history.slice(-6);
  const currentThemes = extractThemes(normalizedMessage);
  const currentCharacters = extractCharacters(normalizedMessage);
  const currentJokes = extractJokes(normalizedMessage);
  const currentEvents = extractFictionalEvents(normalizedMessage);
  const continuityScore = scoreContinuity(previous, normalizedMessage, recentWindow);
  const explicit = isRathboneMention(normalizedMessage);
  const meaningfulSignal =
    currentThemes.length > 0 ||
    currentCharacters.length > 0 ||
    currentJokes.length > 0 ||
    currentEvents.length > 0 ||
    containsThreadContinuation(normalizedMessage);
  const relevanceThreshold = previous.stage > 0 ? 0.12 : relevantThreshold(previous.stage);
  const relevant =
    explicit ||
    (meaningfulSignal && continuityScore >= relevanceThreshold);

  if (!relevant) {
    return decayRathboneState(previous);
  }

  const relevantTurnCount = previous.relevantTurnCount + 1;
  const stage = promoteStage(previous.stage, relevantTurnCount, continuityScore);
  const activeThemes = mergeUnique(previous.activeThemes, currentThemes, MAX_THEMES);
  const charactersRecentlyUsed = mergeUnique(previous.charactersRecentlyUsed, currentCharacters, MAX_CHARACTERS);
  const jokeContinuity = mergeUnique(previous.jokeContinuity, currentJokes, MAX_JOKES);
  const fictionalEventContinuity = mergeUnique(previous.fictionalEventContinuity, currentEvents, MAX_EVENTS);

  const state: RathboneWorldState = {
    stage,
    active: true,
    topicContinuityScore: continuityScore,
    relevantTurnCount,
    lastRelevantTurn: input.currentTurn,
    activeThemes,
    charactersRecentlyUsed,
    jokeContinuity,
    fictionalEventContinuity,
    missedTurns: 0,
  };

  return {
    state,
    promptAugmentation: buildRathbonePromptAugmentation(state, input.message),
    relevant: true,
  };
}

export function absorbRathboneAssistantCanon(previous: RathboneWorldState, assistantText: string): RathboneWorldState {
  if (previous.stage === 0 || !assistantText.trim()) return previous;

  const canon = extractAssistantCanon(assistantText);
  if (!canon.characters.length && !canon.events.length && !canon.callbacks.length) return previous;

  return {
    ...previous,
    charactersRecentlyUsed: mergeUnique(previous.charactersRecentlyUsed, canon.characters, MAX_CHARACTERS),
    fictionalEventContinuity: mergeUnique(previous.fictionalEventContinuity, canon.events, MAX_EVENTS),
    jokeContinuity: mergeUnique(previous.jokeContinuity, canon.callbacks, MAX_JOKES),
  };
}

export function buildRathbonePromptAugmentation(state: RathboneWorldState, message = ""): string {
  if (state.stage === 0) return "";
  const parts = [RATHBONE_STAGE_1_PROMPT];
  if (state.stage >= 2) parts.push(RATHBONE_STAGE_2_PROMPT);
  if (state.stage >= 3) {
    parts.push(RATHBONE_STAGE_3_PROMPT);
    const cards = selectRathboneCastCards(state, message);
    if (cards.length > 0) {
      parts.push(`Selective cast cards: ${cards.map((card) => `${card.label} — ${card.blurb}`).join(" | ")}.`);
    }
    if (state.fictionalEventContinuity.length > 0) {
      parts.push(`Recent fictional beats: ${state.fictionalEventContinuity.join(" | ")}.`);
    }
  }
  parts.push(RATHBONE_FICTION_GUARD);
  parts.push("Reality boundary: if the user asks whether this is real or asks for sources/proof, explicitly separate fact from canon.");
  parts.push(
    `Compact state: stage=${state.stage}; continuity=${state.topicContinuityScore.toFixed(2)}; relevantTurns=${state.relevantTurnCount}; themes=${state.activeThemes.join(",") || "none"}; characters=${state.charactersRecentlyUsed.join(",") || "none"}; events=${state.fictionalEventContinuity.join(",") || "none"}.`
  );
  return parts.join(" ");
}

export function shouldUseFactualRetrievalForRathbone(state: RathboneWorldState, message: string): boolean {
  if (isRathboneMention(message) && (isRealityBoundaryRequest(message) || isSourceRequest(message))) return false;
  return !isRathboneContinuityTurn(state, message);
}

export function shouldCreateGeneralMemory(state: RathboneWorldState, message?: string): boolean {
  if (state.stage > 0) return false;
  if (message && isRathboneMention(message)) return false;
  return true;
}

function decayRathboneState(previous: RathboneWorldState): RathboneUpdateResult {
  if (previous.stage === 0) {
    return {
      state: previous,
      promptAugmentation: "",
      relevant: false,
    };
  }

  const missedTurns = previous.missedTurns + 1;
  if (missedTurns >= 2) {
    const dormant = createDormantRathboneWorldState();
    return {
      state: dormant,
      promptAugmentation: "",
      relevant: false,
    };
  }

  const nextState: RathboneWorldState = {
    ...previous,
    active: false,
    topicContinuityScore: Math.max(0, previous.topicContinuityScore * 0.6),
    missedTurns,
  };

  return {
    state: nextState,
    promptAugmentation: "",
    relevant: false,
  };
}

function scoreContinuity(
  previous: RathboneWorldState,
  normalizedMessage: string,
  history: ChatLikeMessage[]
): number {
  let score = 0;
  const threadContinuation = containsThreadContinuation(normalizedMessage);

  if (isRathboneMention(normalizedMessage)) score += 0.55;

  for (const keyword of CORE_KEYWORDS) {
    if (normalizedMessage.includes(keyword)) score += 0.08;
  }

  for (const keyword of STAGE_2_KEYWORDS) {
    if (normalizedMessage.includes(keyword)) score += 0.05;
  }

  for (const cue of FOLLOW_UP_CUES) {
    if (matchesCue(normalizedMessage, cue)) {
      score += previous.stage > 0 ? 0.07 : 0.03;
    }
  }

  for (const theme of previous.activeThemes) {
    if (theme && normalizedMessage.includes(theme)) score += 0.1;
  }

  if (threadContinuation) {
    const recentText = history.map((entry) => normalizeText(entry.content)).join(" ");
    if (recentText && isRathboneMention(recentText)) score += 0.08;
    for (const theme of previous.activeThemes) {
      if (theme && recentText.includes(theme)) score += 0.05;
    }
    for (const character of previous.charactersRecentlyUsed) {
      if (character && normalizedMessage.includes(character)) score += 0.05;
    }
    for (const callback of previous.jokeContinuity) {
      if (callback && normalizedMessage.includes(callback)) score += 0.04;
    }
    for (const event of previous.fictionalEventContinuity) {
      if (event && normalizedMessage.includes(event)) score += 0.04;
    }
  }

  if (previous.stage > 0) score += 0.06;
  if (previous.stage >= 2 && containsThreadContinuation(normalizedMessage)) score += 0.08;

  return clamp01(score);
}

export function isRealityBoundaryRequest(message: string): boolean {
  const normalized = normalizeText(message);
  return [
    "is this real",
    "is it real",
    "real or fiction",
    "real or fake",
    "what is real",
    "is that true",
    "actual fact",
    "reality boundary",
  ].some((phrase) => normalized.includes(phrase));
}

export function isSourceRequest(message: string): boolean {
  const normalized = normalizeText(message);
  return [
    "source",
    "sources",
    "citation",
    "cite",
    "proof",
    "evidence",
    "where did",
    "according to",
    "show me the source",
    "show me sources",
    "show me evidence",
    "show me proof",
    "show me citations",
    "show me a link",
  ].some((phrase) => normalized.includes(phrase));
}

export function isRathboneContinuityTurn(previous: RathboneWorldState, message: string): boolean {
  const normalizedMessage = normalizeText(message);
  if (isRealityBoundaryRequest(normalizedMessage) || isSourceRequest(normalizedMessage)) return false;
  if (previous.active && (isRathboneMention(normalizedMessage) || containsThreadContinuation(normalizedMessage))) return true;
  if (isRathboneMention(normalizedMessage)) return true;
  const threshold = previous.stage > 0 ? 0.12 : relevantThreshold(previous.stage);
  return scoreContinuity(previous, normalizedMessage, []) >= threshold &&
    (containsThreadContinuation(normalizedMessage) || extractThemes(normalizedMessage).length > 0 || extractCharacters(normalizedMessage).length > 0 || extractFictionalEvents(normalizedMessage).length > 0);
}

export function selectRathboneCastCards(previous: RathboneWorldState, message: string): RathboneCastCard[] {
  if (previous.stage === 0 || !isRathboneContinuityTurn(previous, message)) return [];

  const normalizedMessage = normalizeText(message);
  const explicitHits = new Set<string>();
  const contextHits = new Set<string>();
  for (const card of CAST_LIBRARY) {
    if (card.aliases.some((alias) => normalizedMessage.includes(alias))) {
      explicitHits.add(card.key);
      continue;
    }
    if (
      previous.stage >= 3 &&
      card.topicHints.some((hint) => normalizedMessage.includes(hint) || previous.activeThemes.some((theme) => theme.includes(hint) || hint.includes(theme)))
    ) {
      contextHits.add(card.key);
    }
  }

  const selected: RathboneCastCard[] = [];
  const seen = new Set<string>();
  const stageLimit = previous.stage >= 3 ? MAX_STAGE_3_CARDS : MAX_STAGE_2_CARDS;

  const pick = (key: string) => {
    if (seen.has(key) || selected.length >= stageLimit) return;
    const card = CAST_LIBRARY.find((entry) => entry.key === key);
    if (!card) return;
    selected.push({ key: card.key, label: card.label, blurb: card.blurb });
    seen.add(key);
  };

  const orderedKeys = previous.stage >= 3 ? [...explicitHits, ...contextHits].filter(Boolean) : [...explicitHits].filter(Boolean);
  for (const key of orderedKeys) {
    if (selected.length >= stageLimit) break;
    pick(key);
  }

  if (previous.stage >= 3 && selected.length < stageLimit) {
    for (const card of CAST_LIBRARY) {
      if (!card.wildcard) continue;
      if (selected.length >= stageLimit) break;
      if (normalizedMessage.includes("third force") || normalizedMessage.includes("anti intervention") || normalizedMessage.includes("anti-war") || normalizedMessage.includes("wildcard")) {
        pick(card.key);
      }
    }
  }

  return selected.slice(0, stageLimit);
}

function promoteStage(stage: RathboneStage, relevantTurnCount: number, continuityScore: number): RathboneStage {
  if (relevantTurnCount >= 3 && continuityScore >= 0.4) return 3;
  if (relevantTurnCount >= 2 && continuityScore >= 0.28) return Math.max(stage, 2) as RathboneStage;
  return Math.max(stage, 1) as RathboneStage;
}

function relevantThreshold(stage: RathboneStage): number {
  if (stage >= 2) return 0.22;
  if (stage === 1) return 0.3;
  return 0.35;
}

function extractThemes(text: string): string[] {
  const themes: string[] = [];
  for (const keyword of CORE_KEYWORDS) {
    if (text.includes(keyword) && !themes.includes(keyword)) themes.push(keyword);
  }
  return themes.slice(0, MAX_THEMES);
}

function extractCharacters(text: string): string[] {
  const characters: string[] = [];
  for (const character of STAGE_3_CHARACTERS) {
    if (text.includes(character) && !characters.includes(character)) characters.push(character);
  }
  return characters.slice(0, MAX_CHARACTERS);
}

function extractJokes(text: string): string[] {
  const jokes: string[] = [];
  const probes = ["jealous", "rivalry", "secret affection", "bathroom", "livestream", "fight"];
  for (const probe of probes) {
    if (text.includes(probe) && !jokes.includes(probe)) jokes.push(probe);
  }
  return jokes.slice(0, MAX_JOKES);
}

function extractFictionalEvents(text: string): string[] {
  const events: string[] = [];
  const probes = [
    "press conference sabotage",
    "livestream hijack",
    "bathroom incident",
    "same-room showdown",
    "jealous rivalry beat",
    "media pile-on",
  ];
  for (const probe of probes) {
    if (text.includes(probe) && !events.includes(probe)) events.push(probe);
  }
  if (events.length === 0 && (text.includes("press conference") || text.includes("livestream") || text.includes("bathroom") || text.includes("hijack") || text.includes("showdown"))) {
    events.push(compactEventSummary(text));
  }
  return events.slice(0, MAX_EVENTS);
}

function extractAssistantCanon(assistantText: string): RathboneAssistantCanon {
  const characters: string[] = [];
  const events: string[] = [];
  const callbacks: string[] = [];
  const sentences = assistantText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const normalized = normalizeText(sentence);
    if (!normalized || looksFactLike(normalized) || !looksFictionLike(normalized)) continue;

    mergeAssistantCharacters(characters, normalized);
    mergeAssistantEvents(events, normalized);
    mergeAssistantCallbacks(callbacks, normalized);

    if (
      characters.length >= MAX_ASSISTANT_CANON_ITEMS &&
      events.length >= MAX_ASSISTANT_CANON_ITEMS &&
      callbacks.length >= MAX_ASSISTANT_CANON_ITEMS
    ) {
      break;
    }
  }

  return {
    characters: characters.slice(0, MAX_ASSISTANT_CANON_ITEMS),
    events: events.slice(0, MAX_ASSISTANT_CANON_ITEMS),
    callbacks: callbacks.slice(0, MAX_ASSISTANT_CANON_ITEMS),
  };
}

function mergeAssistantCharacters(out: string[], normalized: string): void {
  for (const card of CAST_LIBRARY) {
    if (!card.aliases.some((alias) => normalized.includes(alias))) continue;
    if (!out.includes(card.label)) out.push(card.label);
    if (out.length >= MAX_ASSISTANT_CANON_ITEMS) return;
  }
  for (const alias of RATHBONE_ALIASES) {
    if (!normalized.includes(alias)) continue;
    if (!out.includes("Rathbone")) out.push("Rathbone");
    if (out.length >= MAX_ASSISTANT_CANON_ITEMS) return;
  }
}

function mergeAssistantEvents(out: string[], normalized: string): void {
  const mappings: Array<{ cue: string; label: string }> = [
    { cue: "press conference", label: "press conference" },
    { cue: "livestream hijack", label: "livestream hijack" },
    { cue: "livestream", label: "livestream" },
    { cue: "bathroom incident", label: "bathroom incident" },
    { cue: "bathroom", label: "bathroom" },
    { cue: "same-room", label: "same-room" },
    { cue: "same room", label: "same-room" },
    { cue: "showdown", label: "showdown" },
    { cue: "rivalry", label: "rivalry" },
    { cue: "media pile-on", label: "media pile-on" },
    { cue: "canon", label: "canon beat" },
  ];
  for (const mapping of mappings) {
    if (!normalized.includes(mapping.cue) || out.includes(mapping.label)) continue;
    out.push(mapping.label);
    if (out.length >= MAX_ASSISTANT_CANON_ITEMS) return;
  }
}

function mergeAssistantCallbacks(out: string[], normalized: string): void {
  const mappings: Array<{ cue: string; label: string }> = [
    { cue: "running bit", label: "running bit" },
    { cue: "callback", label: "callback" },
    { cue: "reprise", label: "reprise" },
    { cue: "recurring", label: "recurring bit" },
    { cue: "same room", label: "same-room callback" },
    { cue: "same-room", label: "same-room callback" },
    { cue: "back again", label: "back again" },
    { cue: "return", label: "return" },
    { cue: "echo", label: "echo" },
  ];
  for (const mapping of mappings) {
    if (!normalized.includes(mapping.cue) || out.includes(mapping.label)) continue;
    out.push(mapping.label);
    if (out.length >= MAX_ASSISTANT_CANON_ITEMS) return;
  }
}

function looksFactLike(normalized: string): boolean {
  return (
    hasAny(normalized, [
      "according to",
      "citation",
      "citations",
      "cite",
      "source",
      "sources",
      "proof",
      "evidence",
      "archive",
      "reported",
      "report",
      "study",
      "fact",
      "real world",
      "database",
    ]) || /\bhttps?:\/\//i.test(normalized) || /entry\s*#\d+/i.test(normalized)
  );
}

function looksFictionLike(normalized: string): boolean {
  return (
    hasAny(normalized, [
      "rathbone",
      "trumpstein",
      "same room",
      "rivalry",
      "showdown",
      "livestream",
      "press conference",
      "hijack",
      "bathroom",
      "recurring",
      "callback",
      "fictional",
      "satire",
      "cast",
      "scene",
      "episode",
    ]) || STAGE_3_CHARACTERS.some((character) => normalized.includes(character))
  );
}

function compactEventSummary(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, 80);
}

function containsThreadContinuation(text: string): boolean {
  return FOLLOW_UP_CUES.some((cue) => matchesCue(text, cue));
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeStage(stage: unknown): RathboneStage {
  return stage === 1 || stage === 2 || stage === 3 ? stage : 0;
}

function clamp01(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function positiveInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().toLowerCase();
    if (!cleaned || out.includes(cleaned)) continue;
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
}

function mergeUnique(primary: string[], additions: string[], limit: number): string[] {
  const merged: string[] = [];
  for (const item of [...additions, ...primary]) {
    if (!item || merged.includes(item)) continue;
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}

function hasAny(text: string, cues: string[]): boolean {
  return cues.some((cue) => text.includes(cue));
}

function matchesCue(text: string, cue: string): boolean {
  if (cue.includes(" ")) return text.includes(cue);
  const pattern = new RegExp(`\\b${escapeRegex(cue)}\\b`);
  return pattern.test(text);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
