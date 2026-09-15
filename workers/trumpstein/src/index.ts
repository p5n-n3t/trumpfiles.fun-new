import type { Ai, Vectorize, D1Database } from "@cloudflare/workers-types";
import { TRUMPSTEIN_SYSTEM_PROMPT } from "./persona";
import { executeRagPlan, buildAugmentedPrompt } from "./rag";
import { handleIngest, type IngestEnv } from "./ingest";
import {
  applyUserTurnConversationState,
  buildConversationStatePrompt,
  type ConversationState,
  Layer0TurnRouter,
  finalizeAssistantConversationState,
  type TurnRoute,
} from "./routing";
import {
  loadSessionState,
  serializeSessionState,
} from "./session-state";
import {
  absorbRathboneAssistantCanon,
  shouldCreateGeneralMemory,
  shouldUseFactualRetrievalForRathbone,
  updateRathboneWorldState,
  type RathboneWorldState,
} from "./rathbone";
import { DEFAULT_CHAT_MODEL, runSelectedStreamingChatModel, selectChatModel } from "./model-routing";

export interface Env extends IngestEnv {
  AI: Ai;
  VECTORIZE: Vectorize;
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  INGEST_SECRET?: string;
  EXA_API_KEY?: string;  // optional web search
  CHAT_MODEL?: string;
  GLM_MODEL?: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  message: string;
  sessionId?: string;
  history?: ChatMessage[];
}

// ── DB init ───────────────────────────────────────────────────────────────────

async function initDb(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      last_active INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS session_state (
      session_id TEXT PRIMARY KEY,
      rathbone_state TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      message_id INTEGER,
      rating INTEGER NOT NULL CHECK(rating IN (1, -1)),
      assistant_content TEXT,
      user_content TEXT,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating, created_at)`),
  ]);
}

// ── CORS ──────────────────────────────────────────────────────────────────────

function corsHeaders(request: Request, allowedOrigins: string): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = allowedOrigins.split(",").map((o) => o.trim());
  const isAllowed =
    allowed.includes("*") ||
    allowed.includes(origin) ||
    origin.endsWith(".vercel.app") ||
    origin.endsWith(".trumpfiles.fun") ||
    origin.endsWith(".trumpstein.me") ||
    origin === "https://trumpfiles.fun" ||
    origin === "https://www.trumpfiles.fun" ||
    origin === "https://trumpstein.me" ||
    origin === "https://www.trumpstein.me";

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0] ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ── Session helpers ───────────────────────────────────────────────────────────

async function ensureSession(db: D1Database, sessionId: string): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO sessions (id, created_at, last_active)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_active = excluded.last_active`
    )
    .bind(sessionId, now, now)
    .run();
}

async function getRecentHistory(
  db: D1Database,
  sessionId: string,
  limit = 20
): Promise<ChatMessage[]> {
  const rows = await db
    .prepare(
      `SELECT role, content FROM messages
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(sessionId, limit)
    .all<{ role: string; content: string }>();

  return (rows.results ?? [])
    .reverse()
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

async function saveMessage(
  db: D1Database,
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await db
    .prepare(`INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`)
    .bind(sessionId, role, content, Date.now())
    .run();
}

async function getSessionState(db: D1Database, sessionId: string): Promise<{ rathbone: RathboneWorldState; conversation: ConversationState }> {
  const row = await db
    .prepare(`SELECT rathbone_state FROM session_state WHERE session_id = ?`)
    .bind(sessionId)
    .first<{ rathbone_state: string }>();
  return loadSessionState(row?.rathbone_state);
}

async function saveSessionStateRow(
  db: D1Database,
  sessionId: string,
  state: { rathbone: RathboneWorldState; conversation: ConversationState }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO session_state (session_id, rathbone_state, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         rathbone_state = excluded.rathbone_state,
         updated_at = excluded.updated_at`
    )
    .bind(sessionId, serializeSessionState(state), Date.now())
    .run();
}

// ── Long-term memory ─────────────────────────────────────────────────────────

async function getMemories(db: D1Database, sessionId: string): Promise<string> {
  const rows = await db
    .prepare(`SELECT summary FROM memories WHERE session_id = ? ORDER BY created_at DESC LIMIT 5`)
    .bind(sessionId)
    .all<{ summary: string }>();
  return (rows.results ?? []).map(r => r.summary).join("\n");
}

async function saveMemory(db: D1Database, sessionId: string, summary: string): Promise<void> {
  await db
    .prepare(`INSERT INTO memories (session_id, summary, created_at) VALUES (?, ?, ?)`)
    .bind(sessionId, summary, Date.now())
    .run();
}

// Summarize conversation into memory every 10 messages
async function maybeCreateMemory(
  db: D1Database,
  sessionId: string,
  ai: Ai,
  allowGeneralMemory: boolean
): Promise<void> {
  if (!allowGeneralMemory) return;

  const countRow = await db
    .prepare(`SELECT COUNT(*) as c FROM messages WHERE session_id = ?`)
    .bind(sessionId)
    .first<{ c: number }>();

  const count = countRow?.c ?? 0;
  if (count < 10 || count % 10 !== 0) return;

  const recent = await db
    .prepare(`SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 20`)
    .bind(sessionId)
    .all<{ role: string; content: string }>();

  const conversation = (recent.results ?? [])
    .reverse()
    .map(r => `${r.role}: ${r.content.slice(0, 200)}`)
    .join("\n");

  const summaryResult = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as Parameters<typeof ai.run>[0], {
    messages: [
      { role: "system", content: "Extract 2-3 key facts about the user's interests and questions from this conversation. Be brief and factual. Format: bullet points only." },
      { role: "user", content: conversation },
    ],
    max_tokens: 150,
    stream: false,
  }) as { response?: string };

  if (summaryResult?.response) {
    await saveMemory(db, sessionId, summaryResult.response);
  }
}

interface WebSearchResult {
  title?: string;
  text?: string;
  url?: string;
}

export function formatWebSearchResults(results: WebSearchResult[] = [], options: { requireUrl?: boolean } = {}): string {
  const seen = new Set<string>();
  return results
    .filter((result) => {
      const validUrl = typeof result.url === "string" && /^https?:\/\//i.test(result.url) ? result.url : "";
      if (options.requireUrl && !validUrl) return false;
      const key = validUrl || `${result.title ?? ""}:${result.text ?? ""}`.slice(0, 120);
      if (!key.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((result) => {
      const title = cleanWebField(result.title, 120) || "Untitled result";
      const url = typeof result.url === "string" && /^https?:\/\//i.test(result.url) ? result.url : "URL unavailable";
      const text = cleanWebField(result.text, 500);
      return [`[WEB] ${title}`, `URL: ${url}`, text ? `Excerpt: ${text}` : null].filter(Boolean).join(" | ");
    })
    .join("\n\n");
}

function cleanWebField(value: string | undefined, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

async function webSearch(query: string, apiKey: string, requireUrl = false): Promise<string> {
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: `Trump ${query}`,
        numResults: 5,
        contents: { text: { maxCharacters: 500 } },
        useAutoprompt: true,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json() as { results?: WebSearchResult[] };
    return formatWebSearchResults(data.results ?? [], { requireUrl });
  } catch {
    return "";
  }
}

// ── /generate endpoint — for auto-update script ──────────────────────────────

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!env.INGEST_SECRET || !secret || secret !== env.INGEST_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { system, user, max_tokens = 4096 } = await request.json() as { system: string; user: string; max_tokens?: number };

  const result = await env.AI.run(
    // Use fast model for /generate endpoint (auto-update structuring task)
    // QwQ-32b times out at 120s in GH Actions; fp8-fast is 5-10x faster
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as Parameters<typeof env.AI.run>[0],
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens,
      temperature: 0.5,
      stream: false,
    }
  ) as { response?: string };

  return new Response(
    JSON.stringify({ response: result?.response ?? "" }),
    { headers: { "Content-Type": "application/json" } }
  );
}

export function rathbonePromptForTurn(
  route: Pick<TurnRoute, "intent" | "rathboneThread">,
  useFactualRetrieval: boolean,
  promptAugmentation: string
): string {
  return route.intent === "rathbone" && !useFactualRetrieval && route.rathboneThread ? promptAugmentation : "";
}

export function factFictionBoundaryForTurn(
  route: Pick<TurnRoute, "intent" | "rathboneThread" | "sourceRequest">,
  useFactualRetrieval: boolean
): string {
  if (!route.rathboneThread || (!route.sourceRequest && route.intent === "rathbone" && !useFactualRetrieval)) return "";
  return [
    "FACT/FICTION BOUNDARY (internal only):",
    "The Rathbone world is fictional Trumpstein canon, not historical evidence.",
    "If the user asks for sources, proof, or real-world facts, say clearly that Rathbone canon is fictional and use only factual archive/live evidence for real claims.",
    "Do not cite, search for, index, or present fictional Rathbone events as real-world records.",
  ].join("\n");
}

// ── Think-block sanitizer (stateful across stream chunks) ────────────────────
// Strips <think>...</think> blocks even when split across multiple chunks/lines.
// Uses a state machine rather than per-chunk regex to handle arbitrary splits.

export class ThinkSanitizer {
  private buf = "";         // pending incomplete tag fragment
  private inThink = false;  // currently inside a think block

  push(token: string): string {
    if (!token) return "";

    let out = "";
    let s = this.buf + token;
    this.buf = "";

    while (s.length > 0) {
      if (this.inThink) {
        // Looking for </think>
        const end = s.indexOf("</think>");
        if (end !== -1) {
          this.inThink = false;
          s = s.slice(end + "</think>".length);
        } else {
          // Might be a split close-tag — buffer the tail
          const partial = "</think>";
          let keep = 0;
          for (let i = 1; i < partial.length; i++) {
            if (s.endsWith(partial.slice(0, i))) { keep = i; }
          }
          this.buf = s.slice(s.length - keep);
          s = "";
        }
      } else {
        // Looking for <think>
        const start = s.indexOf("<think>");
        if (start !== -1) {
          out += s.slice(0, start);
          this.inThink = true;
          s = s.slice(start + "<think>".length);
        } else {
          // Buffer tail that could be start of <think>
          const partial = "<think>";
          let keep = 0;
          for (let i = 1; i < partial.length; i++) {
            if (s.endsWith(partial.slice(0, i))) { keep = i; }
          }
          out += s.slice(0, s.length - keep);
          this.buf = s.slice(s.length - keep);
          s = "";
        }
      }
    }
    return out;
  }

  // Flush any buffered content at end-of-stream (if it never completed a tag)
  flush(): string {
    const out = this.inThink ? "" : this.buf;
    this.buf = "";
    return out;
  }
}

export function patchSsePayload(json: Record<string, unknown>, cleanToken: string): string {
  const choices = Array.isArray(json.choices) ? json.choices : null;
  return JSON.stringify({
    ...json,
    response: cleanToken,
    ...(choices ? {
      choices: choices.map((choice, index) => {
        if (index !== 0 || !choice || typeof choice !== "object") return choice;
        const record = choice as Record<string, unknown>;
        const delta = record.delta && typeof record.delta === "object" ? record.delta as Record<string, unknown> : {};
        return { ...record, delta: { ...delta, content: cleanToken } };
      }),
    } : {}),
  });
}

// ── Main chat handler ─────────────────────────────────────────────────────────

export interface FetchEnv extends Env {
  executionCtx?: ExecutionContext;
}

async function handleChat(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const body = (await request.json()) as ChatRequest;
  const { message, sessionId, history: clientHistory } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "message is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const sid = sessionId ?? crypto.randomUUID();
  const trimmedMessage = message.trim().slice(0, 2000);

  await initDb(env.DB);
  await ensureSession(env.DB, sid);

  let history: ChatMessage[] = await getRecentHistory(env.DB, sid, 20);
  if (history.length === 0 && clientHistory) {
    history = clientHistory.slice(-20);
  }

  const currentTurn = history.filter((msg) => msg.role === "user").length + 1;
  const sessionState = await getSessionState(env.DB, sid);
  const router = new Layer0TurnRouter();
  const route = router.routeTurn(trimmedMessage, history, sessionState.conversation, sessionState.rathbone);
  const priorRathboneState = sessionState.rathbone;
  const rathboneResult = updateRathboneWorldState(priorRathboneState, {
    message: trimmedMessage,
    history,
    currentTurn,
  });
  const rathboneState = rathboneResult.state;
  const userConversationState = applyUserTurnConversationState(
    sessionState.conversation,
    route,
    history,
    trimmedMessage,
    currentTurn
  );
  await saveSessionStateRow(env.DB, sid, {
    rathbone: rathboneState,
    conversation: userConversationState,
  });

  const canReadGeneralMemory = route.intent !== "rathbone" && !route.rathboneThread;
  const canWriteGeneralMemory = shouldCreateGeneralMemory(priorRathboneState, trimmedMessage)
    && shouldCreateGeneralMemory(rathboneState, trimmedMessage);
  const memories = canReadGeneralMemory ? await getMemories(env.DB, sid) : "";

  const useFactualRetrieval = route.retrievalPlan.mode !== "none" && shouldUseFactualRetrievalForRathbone(rathboneState, trimmedMessage);
  const modelHistory = useFactualRetrieval && priorRathboneState.stage > 0 ? [] : history;

  const [ragResult, webResult] = await Promise.all([
    useFactualRetrieval ? executeRagPlan(route.retrievalPlan, env.AI, env.VECTORIZE) : Promise.resolve({ context: "", entryNumbers: [] }),
    env.EXA_API_KEY && route.shouldUseExa && useFactualRetrieval && !route.rathboneThread
      ? webSearch(trimmedMessage, env.EXA_API_KEY, route.sourceRequest)
      : Promise.resolve(""),
  ]);

  const { context, entryNumbers } = ragResult;

  let systemPrompt = buildAugmentedPrompt(
    TRUMPSTEIN_SYSTEM_PROMPT,
    context,
    rathbonePromptForTurn(route, useFactualRetrieval, rathboneResult.promptAugmentation),
    useFactualRetrieval && priorRathboneState.stage > 0 ? "" : buildConversationStatePrompt(userConversationState)
  );
  const factFictionBoundary = factFictionBoundaryForTurn(route, useFactualRetrieval);
  if (factFictionBoundary) systemPrompt += `\n\n${factFictionBoundary}`;
  if (webResult) systemPrompt += `\n\nLIVE WEB CONTEXT:\n${webResult}`;
  if (memories) systemPrompt += `\n\nWHAT I REMEMBER ABOUT THIS USER:\n${memories}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...modelHistory,
    { role: "user", content: trimmedMessage },
  ];

  await saveMessage(env.DB, sid, "user", trimmedMessage);

  const selectedModel = selectChatModel(route, {
    fastModel: env.CHAT_MODEL,
    glmModel: env.GLM_MODEL,
  });
  const modelRun = await runSelectedStreamingChatModel(selectedModel, async (model) => {
    const response = await env.AI.run(
      model as Parameters<typeof env.AI.run>[0],
      { messages, stream: true, max_tokens: 800, temperature: 0.75 }
    );
    return response as unknown as ReadableStream<Uint8Array>;
  });
  if (modelRun.usedFallback) {
    console.warn("Configured deep model unavailable; used the established chat-model fallback.");
  }
  const aiResponse = modelRun.response;

  const rawStream = aiResponse;

  // ── Build a sanitized client stream + capture sanitized text for D1 ─────────
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let capturedAssistant = "";

  // We need to both forward sanitized SSE to client AND capture the full text.
  // We transform the raw stream: buffer incomplete SSE lines across chunks,
  // sanitize think tokens, and re-emit clean SSE events.

  const sanitizer = new ThinkSanitizer();
  let sseLineBuffer = "";

  // streamDone resolves when the transform finishes, carrying sanitized text
  let resolveStreamDone!: (text: string) => void;
  let rejectStreamDone!: (error: unknown) => void;
  const streamDonePromise = new Promise<string>((resolve, reject) => {
    resolveStreamDone = resolve;
    rejectStreamDone = reject;
  });
  let rawReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const clientStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = rawStream.getReader();
      rawReader = reader;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            sseLineBuffer += decoder.decode();
            // Feed the final unterminated SSE frame before flushing so a
            // <think> tag split across frame boundaries cannot leak.
            if (sseLineBuffer.trim() && sseLineBuffer.startsWith("data: ") && !sseLineBuffer.includes("[DONE]")) {
              try {
                const j = JSON.parse(sseLineBuffer.slice(6));
                const tok = j.response ?? j.choices?.[0]?.delta?.content ?? "";
                const clean = sanitizer.push(tok);
                if (clean) {
                  capturedAssistant += clean;
                  controller.enqueue(encoder.encode(`data: ${patchSsePayload(j, clean)}\n\n`));
                }
              } catch { /* ignore */ }
            }
            const tail = sanitizer.flush();
            if (tail) {
              capturedAssistant += tail;
              controller.enqueue(encoder.encode(`data: ${patchSsePayload({}, tail)}\n\n`));
            }
            controller.close();
            resolveStreamDone(capturedAssistant.trim());
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          sseLineBuffer += chunk;

          const lines = sseLineBuffer.split("\n");
          sseLineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ") || line.includes("[DONE]")) {
              controller.enqueue(encoder.encode(line + "\n"));
              continue;
            }
            try {
              const json = JSON.parse(line.slice(6));
              const rawToken = json.response ?? json.choices?.[0]?.delta?.content ?? "";
              const cleanToken = sanitizer.push(rawToken);
              capturedAssistant += cleanToken;
              const patched = patchSsePayload(json, cleanToken);
              controller.enqueue(encoder.encode(`data: ${patched}\n\n`));
            } catch { /* drop malformed data frames rather than bypassing sanitization */ }
          }
        }
      } catch (err) {
        rejectStreamDone(err);
        controller.error(err);
      }
    },
    cancel(reason) {
      rejectStreamDone(reason ?? new Error("client cancelled response stream"));
      return rawReader?.cancel(reason);
    },
  });

  // ── Persist sanitized text using waitUntil so CF doesn't terminate early ────
  const persistWork = streamDonePromise.then(async (sanitizedText) => {
    if (sanitizedText) {
      await saveMessage(env.DB, sid, "assistant", sanitizedText);
      const assistantRathboneState = absorbRathboneAssistantCanon(rathboneState, sanitizedText);
      const finalizedConversationState = finalizeAssistantConversationState(userConversationState, sanitizedText);
      await saveSessionStateRow(env.DB, sid, {
        rathbone: assistantRathboneState,
        conversation: finalizedConversationState,
      });
      await maybeCreateMemory(env.DB, sid, env.AI, canWriteGeneralMemory).catch(() => {});
    }
  });

  if (ctx?.waitUntil) {
    ctx.waitUntil(persistWork.catch(() => {}));
  }
  persistWork.catch(() => {});

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Session-Id": sid,
      "X-Entry-Numbers": entryNumbers.join(","),
      "X-Web-Search": webResult ? "1" : "0",
    },
  });
}

async function handleFeedback(request: Request, env: Env): Promise<Response> {
  const { sessionId, rating, assistantContent, userContent } = await request.json() as {
    sessionId: string;
    rating: 1 | -1;
    assistantContent?: string;
    userContent?: string;
  };

  if (!sessionId || (rating !== 1 && rating !== -1)) {
    return new Response(JSON.stringify({ error: "sessionId and rating (1 or -1) required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  await initDb(env.DB);
  await env.DB.prepare(`INSERT INTO feedback (session_id, rating, assistant_content, user_content, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(sessionId, rating, assistantContent ?? null, userContent ?? null, Date.now())
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}

async function handleHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  await initDb(env.DB);
  const history = await getRecentHistory(env.DB, sessionId, 50);
  return new Response(JSON.stringify({ sessionId, history }), { headers: { "Content-Type": "application/json" } });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const allowedOrigins = env.ALLOWED_ORIGINS ?? "*";
    const cors = corsHeaders(request, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    let response: Response;
    try {
      if (url.pathname === "/chat" && request.method === "POST") {
        response = await handleChat(request, env, ctx);
      } else if (url.pathname === "/generate" && request.method === "POST") {
        response = await handleGenerate(request, env);
      } else if (url.pathname === "/feedback" && request.method === "POST") {
        response = await handleFeedback(request, env);
      } else if (url.pathname === "/history" && request.method === "GET") {
        response = await handleHistory(request, env);
      } else if (url.pathname === "/ingest" && request.method === "POST") {
        response = await handleIngest(request, env);
      } else if (url.pathname === "/health") {
        response = new Response(
          JSON.stringify({
            status: "ok",
            name: "trumpstein",
            model: env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL,
            glm_configured: Boolean(env.GLM_MODEL),
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } else {
        response = new Response("Not Found", { status: 404 });
      }
    } catch (err) {
      console.error("Trumpstein worker error:", err);
      response = new Response(
        JSON.stringify({ error: "Internal server error", detail: String(err) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const newHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors)) newHeaders.set(k, v);
    return new Response(response.body, { status: response.status, headers: newHeaders });
  },
};
