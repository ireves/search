import { handleMcpPost } from "../lib/mcp.js";
import { preflight, requireBearer } from "../lib/oauth.js";

// Claude's connector endpoint: https://<your-deployment>/mcp
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return preflight();
    if (request.method !== "POST") {
      // Stateless server: no server-to-client stream and no sessions to end.
      return new Response("Method not allowed", { status: 405, headers: { allow: "POST, OPTIONS" } });
    }
    const denied = await requireBearer(request);
    if (denied) return denied;
    return handleMcpPost(request);
  },
};
