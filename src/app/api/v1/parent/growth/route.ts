import { route } from "@/server/http";
import { getGrowth } from "@/server/services/growth";

export const GET = route("parent", c => getGrowth(c.session.familyId));
