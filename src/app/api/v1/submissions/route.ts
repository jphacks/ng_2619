import { errors } from "@/server/errors";
import { pageQuery, route } from "@/server/http";
import { listPending } from "@/server/services/reviews";

// F-APV-02（Phase 1 は status=PENDING のみ）
export const GET = route("parent", async (c) => {
  const status = c.url.searchParams.get("status") ?? "PENDING";
  if (status !== "PENDING") throw errors.validation("status は PENDING のみ指定できます");
  return listPending(c.session.familyId, pageQuery(c.url));
});
