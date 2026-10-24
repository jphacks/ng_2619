import { submissionCreateSchema } from "@/lib/schemas";
import { created, route } from "@/server/http";
import { submit } from "@/server/services/kids";

// F-CHL-03〜05
export const POST = route<{ id: string }>("child", async (c) =>
  created(await submit(c.session, c.params.id, await c.body(submissionCreateSchema))),
);
