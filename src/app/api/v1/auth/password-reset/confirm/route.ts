import { passwordResetConfirmSchema } from "@/lib/schemas";
import { route } from "@/server/http";
import { confirmPasswordReset } from "@/server/services/auth";

// F-AUTH-07
export const POST = route("none", async (c) => {
  const { token, password } = await c.body(passwordResetConfirmSchema);
  await confirmPasswordReset(token, password);
  return { ok: true };
});
