import { settingsUpdateSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { route } from "@/server/http";
import { updateSettings } from "@/server/services/account";

export const PATCH = route("parent", async (c) => {
  await assertReauth(c.session);
  const { reauthRequired } = await c.body(settingsUpdateSchema);
  return updateSettings(c.session, reauthRequired);
});
