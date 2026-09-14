import type { D1Database, SendEmail } from "@cloudflare/workers-types";

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 180;
const MAX_MESSAGE_LENGTH = 40_000;
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export interface EmailEnv {
  DB: D1Database;
  EMAIL?: SendEmail;
  CONTACT_RECIPIENT?: string;
  MAIL_FROM?: string;
}

export interface EmailPayload {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  to?: unknown;
  subject?: unknown;
  type?: unknown;
}

export interface ValidatedEmail {
  type: "contact" | "transcript";
  name: string;
  replyTo: string | null;
  subject: string;
  text: string;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, maxLength) : "";
}

function cleanHeader(value: unknown, maxLength: number): string {
  return cleanText(value, maxLength).replace(/[\r\n]+/g, " ");
}

function isEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateEmailPayload(payload: EmailPayload): ValidatedEmail | null {
  const type = payload.type === "transcript" ? "transcript" : "contact";
  const name = cleanHeader(payload.name, MAX_NAME_LENGTH) || (type === "transcript" ? "Trumpstein chat user" : "Anonymous visitor");
  const replyTo = cleanHeader(payload.email ?? payload.to, MAX_EMAIL_LENGTH).toLowerCase();
  const subject = cleanHeader(payload.subject, MAX_SUBJECT_LENGTH) || (type === "transcript" ? "Trumpstein chat transcript" : "Trumpstein contact form message");
  const rawText = typeof payload.message === "string" ? payload.message.replace(/\u0000/g, "").trim() : "";
  if (rawText.length > MAX_MESSAGE_LENGTH) return null;
  const text = rawText;

  if (!text || text.length > MAX_MESSAGE_LENGTH || (replyTo && !isEmail(replyTo))) return null;
  return { type, name, replyTo: replyTo || null, subject, text };
}

export function buildEmailText(email: ValidatedEmail): string {
  const sender = email.replyTo ? `${email.name} <${email.replyTo}>` : email.name;
  const label = email.type === "transcript" ? "Trumpstein chat transcript" : "Contact form message";
  return `${label} from ${sender}\n\n${email.text}`;
}

async function hashRateKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(db: D1Database, key: string): Promise<boolean> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS email_send_rate_limits (
    bucket TEXT PRIMARY KEY,
    window_started INTEGER NOT NULL,
    send_count INTEGER NOT NULL
  )`).run();

  const now = Date.now();
  const existing = await db.prepare("SELECT window_started, send_count FROM email_send_rate_limits WHERE bucket = ?")
    .bind(key)
    .first<{ window_started: number; send_count: number }>();

  if (!existing || now - existing.window_started >= RATE_WINDOW_MS) {
    await db.prepare("INSERT OR REPLACE INTO email_send_rate_limits (bucket, window_started, send_count) VALUES (?, ?, 1)")
      .bind(key, now)
      .run();
    return true;
  }
  if (existing.send_count >= RATE_LIMIT) return false;
  await db.prepare("UPDATE email_send_rate_limits SET send_count = send_count + 1 WHERE bucket = ?").bind(key).run();
  return true;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function handleSendEmail(request: Request, env: EmailEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.EMAIL || !env.CONTACT_RECIPIENT || !env.MAIL_FROM) return json({ error: "Email service is not configured" }, 503);

  const maxPayloadBytes = MAX_MESSAGE_LENGTH + 4_096;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxPayloadBytes) return json({ error: "Message is too large" }, 413);

  let payload: EmailPayload;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxPayloadBytes) return json({ error: "Message is too large" }, 413);
    payload = JSON.parse(body) as EmailPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const email = validateEmailPayload(payload);
  if (!email) return json({ error: "A valid message and optional email address are required" }, 400);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const bucket = await hashRateKey(`${ip}:${request.headers.get("Origin") ?? ""}`);
  if (!await consumeRateLimit(env.DB, bucket)) return json({ error: "Too many messages; try again later" }, 429);

  try {
    await env.EMAIL.send({
      from: env.MAIL_FROM,
      to: env.CONTACT_RECIPIENT,
      subject: email.subject,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      text: buildEmailText(email),
    });
  } catch (error) {
    console.error("Trumpstein email delivery failed", error);
    return json({ error: "Email delivery failed" }, 502);
  }
  return json({ ok: true });
}
