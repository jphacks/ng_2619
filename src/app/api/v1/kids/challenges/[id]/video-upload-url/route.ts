import { videoUploadUrlSchema } from "@/lib/schemas";
import { route } from "@/server/http";
import { createVideoUpload } from "@/server/services/kids";

// F-CHL-03（基本設計書 1.6.2）
export const POST = route<{ id: string }>("child", async (c) =>
  createVideoUpload(c.session, c.params.id, await c.body(videoUploadUrlSchema)),
);
