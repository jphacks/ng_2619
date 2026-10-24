import { route } from "@/server/http";
import { home } from "@/server/services/kids";

// F-CHL-01, 06, F-LV-02, 03（C-01）
export const GET = route("child", async (c) => home(c.session));
