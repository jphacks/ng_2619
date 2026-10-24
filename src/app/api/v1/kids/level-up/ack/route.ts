import { route } from "@/server/http";
import { ackLevelUp } from "@/server/services/kids";

// F-LV-03
export const POST = route("child", async (c) => {
  await ackLevelUp(c.session);
  return { ok: true };
});
