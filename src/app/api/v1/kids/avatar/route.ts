import { avatarUpdateSchema } from "@/lib/schemas";
import { route } from "@/server/http";
import { getAvatarState, updateAvatar } from "@/server/services/avatar";

// F-AVT-01, 02（C-06）
export const GET = route("child", async (c) => getAvatarState(c.session.userId));

export const PUT = route("child", async (c) => {
  const { equips } = await c.body(avatarUpdateSchema);
  return updateAvatar(c.session.userId, equips);
});
