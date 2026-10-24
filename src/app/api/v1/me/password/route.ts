import { mePasswordSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { route } from "@/server/http";
import { changePassword } from "@/server/services/account";

export const PUT = route("parent", async (c) => {
  await assertReauth(c.session);
  const { currentPassword, newPassword } = await c.body(mePasswordSchema);
  await changePassword(c.session, currentPassword, newPassword);
  return { ok: true };
});
