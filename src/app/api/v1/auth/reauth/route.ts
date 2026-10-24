import { reauthSchema } from "@/lib/schemas";
import { route } from "@/server/http";
import { reauth } from "@/server/services/auth";

// F-AUTH-10
export const POST = route("parent", async (c) => {
  const { password } = await c.body(reauthSchema);
  return reauth(c.session, password, { ip: c.ip, userAgent: c.userAgent });
});
