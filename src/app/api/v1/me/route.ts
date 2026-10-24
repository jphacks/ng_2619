import { meUpdateSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { clearedCookies, json, route, withCookies } from "@/server/http";
import { getMe, updateMe, withdraw } from "@/server/services/account";

export const GET = route("any", async (c) => getMe(c.session));

// F-AUTH-11
export const PATCH = route("parent", async (c) => {
  await assertReauth(c.session);
  return updateMe(c.session, await c.body(meUpdateSchema));
});

// 退会（家族ごと消えるので、子どもの Cookie も消す）
export const DELETE = route("parent", async (c) => {
  await assertReauth(c.session);
  await withdraw(c.session);
  return withCookies(json({ ok: true }), clearedCookies());
});
