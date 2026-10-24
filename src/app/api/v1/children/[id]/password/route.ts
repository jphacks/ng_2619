import { childPasswordUpdateSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { route } from "@/server/http";
import { resetChildPassword } from "@/server/services/children";

// F-AUTH-06
export const PUT = route<{ id: string }>("parent", async (c) => {
  await assertReauth(c.session);
  const { password } = await c.body(childPasswordUpdateSchema);
  await resetChildPassword(c.session, c.params.id, password);
  return { ok: true };
});
