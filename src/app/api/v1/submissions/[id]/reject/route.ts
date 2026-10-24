import { rejectSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { route } from "@/server/http";
import { reject } from "@/server/services/reviews";

// F-APV-05
export const POST = route<{ id: string }>("parent", async (c) => {
  await assertReauth(c.session);
  const { comment } = await c.body(rejectSchema);
  return reject(c.session, c.params.id, comment);
});
