import { route } from "@/server/http";
import { getSubmissionDetail } from "@/server/services/reviews";

// F-APV-03
export const GET = route<{ id: string }>("parent", async (c) => getSubmissionDetail(c.session.familyId, c.params.id));
