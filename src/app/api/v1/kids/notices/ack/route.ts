import { noticesAckSchema } from "@/lib/schemas";
import { route } from "@/server/http";
import { ackNotices } from "@/server/services/kids";

// F-CHL-06
export const POST = route("child", async (c) => {
  const { submissionIds } = await c.body(noticesAckSchema);
  await ackNotices(c.session, submissionIds);
  return { ok: true };
});
