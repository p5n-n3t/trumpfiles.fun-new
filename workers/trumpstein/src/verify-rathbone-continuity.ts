import {
  absorbRathboneAssistantCanon,
  createDormantRathboneWorldState,
  isRathboneContinuityTurn,
  updateRathboneWorldState,
} from "./rathbone";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  const dormant = createDormantRathboneWorldState();

  const stage0Noop = absorbRathboneAssistantCanon(dormant, "Rathbone and Shmuley are in a same-room showdown.");
  assert(stage0Noop.stage === 0, "stage 0: assistant canon should not activate dormant state");
  assert(stage0Noop.charactersRecentlyUsed.length === 0, "stage 0: assistant canon should stay empty");

  const seeded = updateRathboneWorldState(dormant, {
    message: "Rathbone and Trumpstein are in the New Orleans streamer thread.",
    history: [],
    currentTurn: 1,
  }).state;
  const firstPrompt = updateRathboneWorldState(dormant, {
    message: "What do you think of Rathbone?",
    history: [],
    currentTurn: 1,
  }).promptAugmentation;
  assert(firstPrompt.includes("never emit a [CHIP OVERRIDE]"), "fiction guard: Rathbone turns must block fictional chip claims");
  assert(firstPrompt.includes("Do not invent subscriber counts"), "fiction guard: Rathbone turns must block invented biography metrics");
  const withCanon = absorbRathboneAssistantCanon(
    seeded,
    "Shmuley returns for a same-room callback, Tucker becomes the wildcard, and the rivalry bit lands."
  );
  assert(withCanon.charactersRecentlyUsed.includes("Shmuley"), "fiction canon: should store introduced character");
  assert(withCanon.fictionalEventContinuity.some((event) => event.includes("same-room")), "fiction canon: should store event");
  assert(withCanon.jokeContinuity.some((bit) => bit.includes("callback")), "fiction canon: should store callback");

  const callbackUserTurn = updateRathboneWorldState(withCanon, {
    message: "what about that same-room callback with Tucker again?",
    history: [{ role: "assistant", content: "Shmuley returns for a same-room callback, Tucker becomes the wildcard, and the rivalry bit lands." }],
    currentTurn: 2,
  });
  assert(callbackUserTurn.relevant === true, "later callback recovery: should stay relevant");
  assert(isRathboneContinuityTurn(withCanon, "what about that same-room callback with Tucker again?"), "later callback recovery: continuity should be recognized");

  const factualText = absorbRathboneAssistantCanon(
    withCanon,
    "According to Entry #12 and the archive, here is a factual citation with a source link: https://example.com"
  );
  assert(factualText.charactersRecentlyUsed.length === withCanon.charactersRecentlyUsed.length, "fact isolation: factual text should not change canon characters");
  assert(factualText.fictionalEventContinuity.length === withCanon.fictionalEventContinuity.length, "fact isolation: factual text should not change canon events");

  const unrelatedDecay = updateRathboneWorldState(withCanon, {
    message: "what is the GDP of Lebanon?",
    history: [{ role: "user", content: "Rathbone and Trumpstein are in the New Orleans streamer thread." }],
    currentTurn: 3,
  });
  assert(unrelatedDecay.state.active === false, "decay: unrelated factual shift should deactivate the thread");
  assert(unrelatedDecay.state.stage > 0, "decay: stage should decay, not reset immediately");

  console.log("verify-rathbone-continuity: ok");
}

main();
