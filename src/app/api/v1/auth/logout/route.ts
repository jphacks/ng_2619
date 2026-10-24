import { clearedCookies, json, readCookie, route, SESSION_COOKIE, withCookies } from "@/server/http";
import { logout } from "@/server/services/auth";

// F-AUTH-02
export const POST = route("none", async (c) => {
  await logout(readCookie(c.req, SESSION_COOKIE));
  return withCookies(json({ ok: true }), clearedCookies());
});
