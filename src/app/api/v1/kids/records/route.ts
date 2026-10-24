import { route } from "@/server/http";
import { records } from "@/server/services/kids";

// F-CHL-07（C-05）
export const GET = route("child", async (c) => records(c.session));
