import { routeOf } from "../lib/config.js";
import { homePage, handleSettings } from "../lib/settings.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const route = routeOf(request, (pathname) => (pathname === "/" ? "home" : "settings"));
    if (route === "home") return homePage(request);
    return handleSettings(request);
  },
};
