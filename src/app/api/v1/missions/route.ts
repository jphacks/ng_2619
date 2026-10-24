import { CHALLENGE_STATUSES, type ChallengeStatus } from "@/lib/constants";
import { missionCreateSchema } from "@/lib/schemas";
import { errors } from "@/server/errors";
import { created, pageQuery, route } from "@/server/http";
import { createMission, listMissions } from "@/server/services/missions";

// F-MIS-02
export const GET = route("parent", async (c) => {
  const status = c.url.searchParams.get("status") || undefined;
  if (status && !CHALLENGE_STATUSES.includes(status as ChallengeStatus)) throw errors.validation("status が正しくありません");
  return listMissions(c.session.familyId, {
    childId: c.url.searchParams.get("childId") || undefined,
    status: status as ChallengeStatus | undefined,
    ...pageQuery(c.url),
  });
});

// F-MIS-01
export const POST = route("parent", async (c) => created(await createMission(c.session, await c.body(missionCreateSchema))));
