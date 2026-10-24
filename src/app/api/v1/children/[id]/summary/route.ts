import { route } from "@/server/http";
import { childSummary } from "@/server/services/children";

// F-APV-06（P-06）
export const GET = route<{ id: string }>("parent", async (c) => childSummary(c.session.familyId, c.params.id));
