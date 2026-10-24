import { route } from "@/server/http";
import { challengeDetail } from "@/server/services/kids";

// F-CHL-02（C-02）
export const GET = route<{ id: string }>("child", async (c) => challengeDetail(c.session, c.params.id));
