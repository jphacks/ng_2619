import { reviewCommentSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { route } from "@/server/http";
import { completeDirectly } from "@/server/services/reviews";

// F-APV-08 保護者による達成の直接登録
export const POST = route<{ id: string }>("parent", async (c) => {
  await assertReauth(c.session);
  const { comment } = await c.body(reviewCommentSchema);
  return completeDirectly(c.session, c.params.id, comment);
});
