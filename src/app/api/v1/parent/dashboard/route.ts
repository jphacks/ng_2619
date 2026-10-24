import { route } from "@/server/http";
import { parentDashboard } from "@/server/services/dashboard";

// F-APV-01（P-01）
export const GET = route("parent", async (c) => parentDashboard(c.session.familyId));
