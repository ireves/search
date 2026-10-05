import { routeOf } from "../lib/config.js";
import { json } from "../lib/html.js";
import { authorizationServerMetadata, authorize, preflight, protectedResourceMetadata, register, token } from "../lib/oauth.js";

function fromPath(pathname: string): string {
  if (pathname.startsWith("/.well-known/oauth-protected-resource")) return "protected-resource";
  if (pathname.startsWith("/.well-known/oauth-authorization-server")) return "authorization-server";
  if (pathname.startsWith("/.well-known/openid-configuration")) return "authorization-server";
  return pathname.replace(/^\/+|\/+$/g, "");
}

export default {
  async fetch(request: Request): Promise<Response> {
    const route = routeOf(request, fromPath);
    if (request.method === "OPTIONS") return preflight();
    switch (route) {
      case "protected-resource":
        return protectedResourceMetadata(request);
      case "authorization-server":
        return authorizationServerMetadata(request);
      case "register":
        return register(request);
      case "authorize":
        return authorize(request);
      case "token":
        return token(request);
      default:
        return json({ error: "not_found" }, 404);
    }
  },
};
