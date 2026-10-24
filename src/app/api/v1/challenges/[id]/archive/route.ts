import { route } from "@/server/http";
import { archiveChallenge } from "@/server/services/missions";

// F-MIS-04
export const POST = route<{ id: string }>("parent", async (c) => archiveChallenge(c.session.familyId, c.params.id));
