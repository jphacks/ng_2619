import { childUpdateSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { route } from "@/server/http";
import { deleteChild, updateChild } from "@/server/services/children";

type P = { id: string };

// F-AUTH-05
export const PATCH = route<P>("parent", async (c) => {
  await assertReauth(c.session);
  return updateChild(c.session, c.params.id, await c.body(childUpdateSchema));
});

export const DELETE = route<P>("parent", async (c) => {
  await assertReauth(c.session);
  await deleteChild(c.session, c.params.id);
  return { ok: true };
});
