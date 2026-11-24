import { POST } from "./intake";
const allowedOrigin = "https://deep-real.github.io";
export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (origin && origin !== allowedOrigin) return new Response("Forbidden", { status: 403 });
    const cors = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key", "Vary": "Origin", "Cache-Control": "no-store" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/api/applications") return new Response("Not found", { status: 404, headers: cors });
    const headers = new Headers(request.headers);
    headers.delete("Origin");
    const response = await POST(new Request(request, { headers }));
    const result = new Response(response.body, response);
    Object.entries(cors).forEach(([key,value]) => result.headers.set(key,value));
    return result;
  }
};
