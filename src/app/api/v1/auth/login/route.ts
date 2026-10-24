import { loginSchema } from "@/lib/schemas";
import { json, route, sessionCookies, withCookies } from "@/server/http";
import { login } from "@/server/services/auth";

// F-AUTH-01, 08
export const POST = route("none", async (c) => {
  const input = await c.body(loginSchema);
  const r = await login(input, { ip: c.ip, userAgent: c.userAgent });
  return withCookies(json({ role: r.role, redirectTo: r.redirectTo }), sessionCookies(r.token, r.role, r.ttlSec));
});
