import { TRUMPSTEIN_SYSTEM_PROMPT } from "./persona";
import { buildAugmentedPrompt } from "./rag";
import { factFictionBoundaryForTurn, formatWebSearchResults, rathbonePromptForTurn } from "./index";
import {
  applyUserTurnConversationState,
  buildConversationStatePrompt,
  createDefaultConversationState,
  type Layer0Intent,
  Layer0TurnRouter,
} from "./routing";
import {
  createDefaultSessionState,
  parseSessionState,
  serializeSessionState,
} from "./session-state";
import {
  createDormantRathboneWorldState,
  shouldCreateGeneralMemory,
  shouldUseFactualRetrievalForRathbone,
  updateRathboneWorldState,
} from "./rathbone";

function main(): void {
  const router = new Layer0TurnRouter();

  caseA(router);
  caseB(router);
  caseC(router);
  caseD(router);
  caseE(router);
  caseF(router);
  caseG(router);
  caseH(router);
  caseI(router);
  caseJ(router);
  caseK();
  caseL();
  caseM(router);
  caseN();
  caseO(router);
  caseP(router);

  console.log("verify-routing: ok");
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function caseA(router: Layer0TurnRouter): void {
  const route = router.routeTurn("keep the banter light and talk like a podcast host", [], createDefaultConversationState(), createDormantRathboneWorldState());
  assert(route.intent === "casual/persona", "case A: expected casual/persona");
  assert(route.retrievalPlan.mode === "none", "case A: expected no retrieval");
  assert(route.shouldUseExa === false, "case A: expected no Exa");
}

function caseB(router: Layer0TurnRouter): void {
  const route = router.routeTurn("Who is Ben Shapiro and what is his media lane?", [], createDefaultConversationState(), createDormantRathboneWorldState());
  assert(route.intent === "corpus factual", "case B: expected corpus factual");
  assert(route.retrievalPlan.mode === "single", "case B: expected single retrieval");
  assert(route.retrievalPlan.query.length > 0, "case B: expected query");
  assert(route.retrievalPlan.query.includes("media lane"), "case B: single retrieval must preserve the user's semantic terms");
}

function caseC(router: Layer0TurnRouter): void {
  const route = router.routeTurn("latest news on Gaza ceasefire talks", [], createDefaultConversationState(), createDormantRathboneWorldState());
  assert(route.intent === "current news", "case C: expected current news");
  assert(route.shouldUseExa === true, "case C: expected Exa");
  assert(route.retrievalPlan.useExa === true, "case C: expected retrieval Exa");
}

function caseD(router: Layer0TurnRouter): void {
  const route = router.routeTurn(
    "Give me the deep thematic throughline connecting Hasan and Tucker across the media war.",
    [],
    createDefaultConversationState(),
    createDormantRathboneWorldState()
  );
  assert(route.intent === "deep thematic", "case D: expected deep thematic");
  assert(route.retrievalPlan.mode === "multi", "case D: expected multi retrieval");
  assert(route.retrievalPlan.subqueries.length >= 2, "case D: expected multiple subqueries");
}

function caseE(router: Layer0TurnRouter): void {
  const route = router.routeTurn("show me the source for that claim", [], createDefaultConversationState(), createDormantRathboneWorldState());
  assert(route.intent === "source request", "case E: expected source request");
  assert(route.sourceRequest === true, "case E: expected source flag");
  const casual = router.routeTurn("show me a joke", [], createDefaultConversationState(), createDormantRathboneWorldState());
  assert(casual.sourceRequest === false, "case E: casual show-me prompt must not trigger source retrieval");
}

function caseF(router: Layer0TurnRouter): void {
  const state = applyUserTurnConversationState(
    {
      ...createDefaultConversationState(),
      currentTopic: "media feud",
    },
    router.routeTurn("what did you say earlier?", [{ role: "assistant", content: "I said [CHIP OVERRIDE: Entry #17] it was a glitch." }], createDefaultConversationState(), createDormantRathboneWorldState()),
    [{ role: "assistant", content: "I said [CHIP OVERRIDE: Entry #17] it was a glitch." }],
    "what did you say earlier?",
    2
  );
  assert(state.lastChipReference === "Entry #17", "case F: expected chip reference");
  assert(state.recentIntents.length > 0, "case F: expected recent intent tracking");
  assert(router.routeTurn("what did you say earlier?", [{ role: "assistant", content: "I said [CHIP OVERRIDE: Entry #17] it was a glitch." }], createDefaultConversationState(), createDormantRathboneWorldState()).referencesPreviousAnswer, "case F: expected follow-up/coreference signal");
}

function caseG(router: Layer0TurnRouter): void {
  const state = updateRathboneWorldState(createDormantRathboneWorldState(), {
    message: "Rathbone and Trumpstein are back in the New Orleans musician streamer thread.",
    history: [],
    currentTurn: 1,
  }).state;
  const route = router.routeTurn(
    "Rathbone and Trumpstein are back in the New Orleans musician streamer thread.",
    [],
    createDefaultConversationState(),
    state
  );
  assert(route.intent === "rathbone", "case G: expected rathbone intent");
  const prompt = updateRathboneWorldState(createDormantRathboneWorldState(), {
    message: "Rathbone and Trumpstein are back in the New Orleans musician streamer thread.",
    history: [],
    currentTurn: 1,
  }).promptAugmentation;
  assert(prompt.includes("Small core only"), "case G: expected small core prompt");
  assert(!prompt.includes("Selective cast cards"), "case G: expected no cast dump at stage 1");
}

function caseH(router: Layer0TurnRouter): void {
  let state = createDormantRathboneWorldState();
  state = updateRathboneWorldState(state, {
    message: "Rathbone and Trumpstein are back in the New Orleans musician streamer thread.",
    history: [],
    currentTurn: 1,
  }).state;
  const unrelated = updateRathboneWorldState(state, {
    message: "What is the GDP of Lebanon?",
    history: [{ role: "user", content: "Rathbone and Trumpstein are back in the New Orleans musician streamer thread." }],
    currentTurn: 2,
  });
  assert(unrelated.state.active === false, "case H: expected inactive after unrelated turn");
  assert(unrelated.state.stage > 0, "case H: expected stage to remain above zero");
  assert(shouldUseFactualRetrievalForRathbone(unrelated.state, "What is the GDP of Lebanon?") === true, "case H: expected factual retrieval to resume");
  assert(shouldCreateGeneralMemory(unrelated.state, "What is the GDP of Lebanon?") === false, "case H: recent fictional state must stay out of general-memory writes");
  const factualRoute = router.routeTurn("What is the GDP of Lebanon?", [], createDefaultConversationState(), unrelated.state);
  assert(factualRoute.intent !== "rathbone", "case H: unrelated turn must not stay rathbone");
}

function caseI(router: Layer0TurnRouter): void {
  let state = createDormantRathboneWorldState();
  state = updateRathboneWorldState(state, {
    message: "Rathbone and Trumpstein are back in the New Orleans musician streamer thread.",
    history: [],
    currentTurn: 1,
  }).state;
  state = updateRathboneWorldState(state, {
    message: "What is the GDP of Lebanon?",
    history: [{ role: "user", content: "Rathbone and Trumpstein are back in the New Orleans musician streamer thread." }],
    currentTurn: 2,
  }).state;
  const returnRoute = router.routeTurn(
    "what about that same-room rivalry with Hasan and Tucker?",
    [{ role: "assistant", content: "Let's keep the fictional rivalry rolling." }],
    createDefaultConversationState(),
    state
  );
  assert(returnRoute.intent === "rathbone", "case I: expected return to rathbone");
  const returned = updateRathboneWorldState(state, {
    message: "what about that same-room rivalry with Hasan and Tucker?",
    history: [{ role: "assistant", content: "Let's keep the fictional rivalry rolling." }],
    currentTurn: 3,
  });
  assert(returned.relevant === true, "case I: expected rathbone continuity to remain relevant");
}

function caseJ(router: Layer0TurnRouter): void {
  const route = router.routeTurn("you are a stupid idiot clown", [], createDefaultConversationState(), createDormantRathboneWorldState());
  assert(route.intent === "hostile banter", "case J: expected hostile banter");
  assert(route.retrievalPlan.mode === "none", "case J: expected no retrieval");
}

function caseK(): void {
  let state = createDormantRathboneWorldState();
  state = updateRathboneWorldState(state, {
    message: "Rathbone, Shmuley, Hasan, and Tucker are in the same room now.",
    history: [],
    currentTurn: 1,
  }).state;
  state = updateRathboneWorldState(state, {
    message: "same-room rivalry again with Hasan and Tucker in the thread",
    history: [{ role: "assistant", content: "keep it fictional" }],
    currentTurn: 2,
  }).state;
  const result = updateRathboneWorldState(state, {
    message: "same-room rivalry again with Hasan, Shmuley, and Tucker in the thread",
    history: [{ role: "assistant", content: "keep it fictional" }],
    currentTurn: 3,
  });
  const prompt = result.promptAugmentation;
  assert(result.state.stage === 3, "case K: expected stage 3 continuity");
  assert(prompt.includes("Selective cast cards"), "case K: expected selective cast cards");
  assert(prompt.includes("Shmuley"), "case K: expected Shmuley");
  assert(prompt.includes("Hasan"), "case K: expected Hasan");
  assert(prompt.includes("Tucker"), "case K: expected Tucker");
  assert(!prompt.includes("Ben Shapiro —"), "case K: expected no roster dump");
}

function caseL(): void {
  const original = {
    ...createDefaultSessionState(),
    conversation: {
      ...createDefaultConversationState(),
      currentTopic: "media feud",
      entities: ["Rathbone", "Tucker"],
      recentIntents: ["deep thematic", "source request"] as Layer0Intent[],
      lastChipFact: "Entry #17 says the chip glitched.",
    },
  };
  const roundTrip = parseSessionState(serializeSessionState(original));
  assert(roundTrip.conversation.currentTopic === "media feud", "case L: expected topic round-trip");
  assert(roundTrip.conversation.entities[0] === "rathbone", "case L: expected normalized entities round-trip");
  assert(roundTrip.rathbone.stage === 0, "case L: expected dormant Rathbone");
  const legacy = parseSessionState(JSON.stringify(createDormantRathboneWorldState()));
  assert(legacy.rathbone.active === false, "case L: expected legacy parse");
}

function caseM(router: Layer0TurnRouter): void {
  const route = router.routeTurn("what is the unemployment rate in Lebanon?", [], createDefaultConversationState(), createDormantRathboneWorldState());
  const prompt = buildAugmentedPrompt(TRUMPSTEIN_SYSTEM_PROMPT, "Entry #1", "", buildConversationStatePrompt(createDefaultConversationState()));
  assert(route.rathboneThread === false, "case M: expected no Rathbone contamination");
  assert(prompt.includes("RATHBONE CANON") === false, "case M: expected no Rathbone block");
  assert(route.retrievalPlan.mode === "single", "case M: expected factual retrieval");
}

function caseN(): void {
  const formatted = formatWebSearchResults([
    { title: "First", url: "https://example.org/a", text: "Evidence text" },
    { title: "Duplicate", url: "https://example.org/a", text: "Duplicate text" },
    { title: "No URL", text: "Useful but uncited" },
  ]);
  assert(formatted.includes("URL: https://example.org/a"), "case N: expected live web URL provenance");
  assert(formatted.includes("URL unavailable"), "case N: expected explicit missing URL label");
  assert(formatted.match(/\[WEB\]/g)?.length === 2, "case N: expected URL dedupe");
  const sourcedOnly = formatWebSearchResults([
    { title: "Sourced", url: "https://example.org/a", text: "Evidence text" },
    { title: "No URL", text: "Uncited text" },
  ], { requireUrl: true });
  assert(!sourcedOnly.includes("URL unavailable"), "case N: source requests must exclude results without URLs");
}

function caseO(router: Layer0TurnRouter): void {
  let state = createDormantRathboneWorldState();
  state = updateRathboneWorldState(state, {
    message: "Do you know Rathbone?",
    history: [],
    currentTurn: 1,
  }).state;
  state = updateRathboneWorldState(state, {
    message: "same-room rivalry with Shmuley again",
    history: [{ role: "user", content: "Do you know Rathbone?" }],
    currentTurn: 2,
  }).state;
  const sourceRoute = router.routeTurn(
    "give me sources proving Shmuley really fought Rathbone",
    [{ role: "assistant", content: "Fictional rivalry bit." }],
    createDefaultConversationState(),
    state
  );
  assert(sourceRoute.sourceRequest === true, "case O: expected source request");
  assert(sourceRoute.shouldUseExa === true, "case O: router may identify the generic source-search intent");
  assert(rathbonePromptForTurn(sourceRoute, false, "Rathbone canon payload") === "", "case O: source boundary must not inject Rathbone canon");
  assert(factFictionBoundaryForTurn(sourceRoute, false).includes("fictional Trumpstein canon"), "case O: expected fact/fiction boundary without factual retrieval");
}

function caseP(router: Layer0TurnRouter): void {
  const route = router.routeTurn(
    "What is the unemployment rate?",
    [{ role: "assistant", content: "Previous unrelated answer." }],
    createDefaultConversationState(),
    createDormantRathboneWorldState()
  );
  assert(route.referencesPreviousAnswer === false, "case P: 'the' must not match the short follow-up cue 'he'");
  assert(route.sourceRequest === false, "case P: unrelated words must not trigger source cues");
}

main();
