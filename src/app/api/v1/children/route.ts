import { MAX_CHILDREN_PER_FAMILY } from "@/lib/constants";
import { childCreateSchema } from "@/lib/schemas";
import { assertReauth } from "@/server/auth/reauth";
import { prisma } from "@/server/db";
import { created, route } from "@/server/http";
import { createChild, listChildCards } from "@/server/services/children";

export const GET = route("parent", async (c) => ({
  items: await listChildCards(prisma, c.session.familyId),
  max: MAX_CHILDREN_PER_FAMILY,
}));

// F-AUTH-04
export const POST = route("parent", async (c) => {
  await assertReauth(c.session);
  return created(await createChild(c.session, await c.body(childCreateSchema)));
});
