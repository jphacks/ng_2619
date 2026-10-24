import { missionUpdateSchema } from "@/lib/schemas";
import { route } from "@/server/http";
import { getMission, updateMission } from "@/server/services/missions";

type P = { id: string };

export const GET = route<P>("parent", async (c) => getMission(c.session.familyId, c.params.id));

// F-MIS-03
export const PATCH = route<P>("parent", async (c) =>
  updateMission(c.session.familyId, c.params.id, await c.body(missionUpdateSchema)),
);
