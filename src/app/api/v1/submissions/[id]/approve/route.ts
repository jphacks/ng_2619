import { reviewCommentSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { route } from "@/server/http";
import { approve } from "@/server/services/reviews";

// F-APV-04
export const POST = route<{ id: string }>("parent", async (c) => {
  await assertReauth(c.session);
  const { comment } = await c.body(reviewCommentSchema);
  return approve(c.session, c.params.id, comment);
});
