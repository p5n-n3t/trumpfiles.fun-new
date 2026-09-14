import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.TRUMPSTEIN_WORKER_URL
  ?? process.env.NEXT_PUBLIC_TRUMPSTEIN_WORKER_URL
  ?? "https://trumpstein.trumpstein.workers.dev";
const MAX_EMAIL_REQUEST_BYTES = 44_096;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_EMAIL_REQUEST_BYTES) {
    return NextResponse.json({ error: "Message is too large" }, { status: 413 });
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_EMAIL_REQUEST_BYTES) {
    return NextResponse.json({ error: "Message is too large" }, { status: 413 });
  }

  try {
    const response = await fetch(`${WORKER_URL.replace(/\/$/, "")}/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: request.headers.get("origin") ?? "https://trumpstein.me",
      },
      body,
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Email service unavailable" }, { status: 502 });
  }
}
