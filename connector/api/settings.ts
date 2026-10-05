import { routeOf } from "../lib/config.js";
import { homePage, handleSettings, passkeyOptions, passkeyScript } from "../lib/settings.js";

function fromPath(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname === "/passkey.js") return "passkey-script";
  if (pathname === "/passkey/options") return "passkey-options";
  return "settings";
}

export default {
  async fetch(request: Request): Promise<Response> {
    switch (routeOf(request, fromPath)) {
      case "home":
        return homePage(request);
      case "passkey-script":
        return passkeyScript();
      case "passkey-options":
        return passkeyOptions(request);
      default:
        return handleSettings(request);
    }
  },
};
