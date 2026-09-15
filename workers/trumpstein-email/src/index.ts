import { handleSendEmail, type EmailEnv } from "./email";

interface Env extends EmailEnv {
  ALLOWED_ORIGINS?: string;
}

function corsHeaders(request: Request, allowedOrigins: string): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = allowedOrigins.split(",").map((value) => value.trim());
  const isAllowed = allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0] ?? "",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env.ALLOWED_ORIGINS ?? "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (new URL(request.url).pathname !== "/send-email" || request.method !== "POST") {
      return new Response("Not Found", { status: 404, headers: cors });
    }
    const response = await handleSendEmail(request, env);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(cors)) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
