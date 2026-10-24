import { passwordResetRequestSchema } from "@/lib/schemas";
import { route } from "@/server/http";
import { requestPasswordReset } from "@/server/services/auth";

// F-AUTH-07。登録の有無にかかわらず同じ応答を返す
export const POST = route("none", async (c) => {
  const { email } = await c.body(passwordResetRequestSchema);
  await requestPasswordReset(email);
  return { ok: true };
});
