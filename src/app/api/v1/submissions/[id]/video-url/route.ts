import { route } from "@/server/http";
import { getVideoUrl } from "@/server/services/reviews";

// F-APV-03 再生用の署名付きURL（有効10分）
export const GET = route<{ id: string }>("parent", async (c) => getVideoUrl(c.session.familyId, c.params.id));
