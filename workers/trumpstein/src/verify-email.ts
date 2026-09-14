import type { D1Database, SendEmail } from "@cloudflare/workers-types";
import { buildEmailText, handleSendEmail, validateEmailPayload } from "./email";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
const contact = validateEmailPayload({ name: "Ada", email: "ada@example.com", message: "A useful source." });
assert(contact?.replyTo === "ada@example.com", "contact reply-to should be retained");
assert(contact?.type === "contact", "contact payload should be classified");
assert(buildEmailText(contact!).includes("Contact form message from Ada <ada@example.com>"), "text email should identify the contact sender");
assert(validateEmailPayload({ email: "not-an-email", message: "x" }) === null, "malformed email should be rejected");
assert(validateEmailPayload({ subject: "bad\r\nBcc: attacker@example.com", message: "x" })?.subject === "bad Bcc: attacker@example.com", "header newlines should be flattened");
assert(validateEmailPayload({ type: "transcript", to: "visitor@example.com", subject: "Transcript", message: "Hello" })?.type === "transcript", "transcript payload should be accepted");
assert(validateEmailPayload({ message: "x".repeat(40_001) }) === null, "oversized messages should be rejected rather than truncated");

interface RateRow {
  window_started: number;
  send_count: number;
}

class FakeStatement {
  private args: unknown[] = [];

  constructor(private readonly sql: string, private readonly rows: Map<string, RateRow>) {}

  bind(...args: unknown[]): this {
    this.args = args;
    return this;
  }

  async run(): Promise<Record<string, never>> {
    if (this.sql.startsWith("INSERT OR REPLACE")) {
      const [bucket, windowStarted, sendCount] = this.args as [string, number, number];
      this.rows.set(bucket, { window_started: windowStarted, send_count: sendCount });
    }
    if (this.sql.startsWith("UPDATE email_send_rate_limits")) {
      const [bucket] = this.args as [string];
      const current = this.rows.get(bucket);
      if (current) current.send_count += 1;
    }
    return {};
  }

  async first<T>(): Promise<T | null> {
    if (!this.sql.startsWith("SELECT")) return null;
    const [bucket] = this.args as [string];
    return (this.rows.get(bucket) ?? null) as T | null;
  }
}

function createFakeDb(): D1Database {
  const rows = new Map<string, RateRow>();
  return {
    prepare(sql: string) {
      return new FakeStatement(sql, rows);
    },
  } as unknown as D1Database;
}

interface SentEmail {
  from: string;
  to: string;
  subject: string;
  replyTo?: string;
  text?: string;
}

const sent: SentEmail[] = [];
const sender = {
  async send(message: unknown) {
    sent.push(message as SentEmail);
    return { messageId: "test-message" };
  },
} as unknown as SendEmail;

const env = {
  DB: createFakeDb(),
  EMAIL: sender,
  CONTACT_RECIPIENT: "owner@example.com",
  MAIL_FROM: "hello@example.com",
};

const response = await handleSendEmail(new Request("https://worker.test/send-email", {
  method: "POST",
  headers: { "CF-Connecting-IP": "203.0.113.9" },
  body: JSON.stringify({ type: "contact", name: "Ada", email: "ada@example.com", subject: "Source lead", message: "A useful source." }),
}), env);
assert(response.status === 200, "valid contact message should be accepted");
assert(sent.length === 1, "accepted contact message should be sent once");
assert(sent[0]?.from === "hello@example.com" && sent[0]?.to === "owner@example.com", "Cloudflare builder should use configured addresses");
assert(sent[0]?.replyTo === "ada@example.com", "Cloudflare builder should preserve reply-to");
assert(sent[0]?.text?.includes("A useful source."), "Cloudflare builder should include body text");

const oversizeResponse = await handleSendEmail(new Request("https://worker.test/send-email", {
  method: "POST",
  body: JSON.stringify({ message: "x".repeat(45_000) }),
}), env);
assert(oversizeResponse.status === 413, "oversized request bodies should be rejected before delivery");

const originalConsoleError = console.error;
console.error = () => undefined;
try {
  const failingResponse = await handleSendEmail(new Request("https://worker.test/send-email", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.10" },
    body: JSON.stringify({ message: "Will not send" }),
  }), { ...env, EMAIL: { async send() { throw new Error("provider unavailable"); } } as unknown as SendEmail });
  assert(failingResponse.status === 502, "provider failures should not be exposed as successful sends");
} finally {
  console.error = originalConsoleError;
}

console.log("verify-email: ok");
}

void run();
