import { signupSchema } from "@/lib/schemas";
import { json, route, sessionCookies, withCookies } from "@/server/http";
import { signup } from "@/server/services/auth";

// F-AUTH-03
export const POST = route("none", async (c) => {
  const input = await c.body(signupSchema);
  const r = await signup(input, { ip: c.ip, userAgent: c.userAgent });
  return withCookies(json({ role: r.role, redirectTo: r.redirectTo }, 201), sessionCookies(r.token, r.role, r.ttlSec));
});
