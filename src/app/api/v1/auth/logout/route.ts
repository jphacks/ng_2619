import { clearedCookies, json, readCookie, route, SESSION_COOKIES, sessionRole, withCookies } from "@/server/http";
import { logout } from "@/server/services/auth";

// F-AUTH-02。いま使っている画面のロール（保護者か子どもか）のセッションだけを終える
export const POST = route("none", async (c) => {
  const role = sessionRole(c.req, "any");
  if (!role) return json({ ok: true });
  await logout(readCookie(c.req, SESSION_COOKIES[role]));
  return withCookies(json({ ok: true }), clearedCookies(role));
});
