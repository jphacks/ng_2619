// マスタデータ（基本設計書 5.3 共通 GET /masters）
import { createHash } from "node:crypto";
import type { Masters } from "@/lib/types";
import { prisma } from "../db";

export async function getMasters(): Promise<{ body: Masters; etag: string }> {
  const [categories, stamps, commentTemplates, levels] = await Promise.all([
    prisma.missionCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.stamp.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.commentTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.levelMaster.findMany({ orderBy: { level: "asc" } }),
  ]);
  const body: Masters = {
    categories: categories.map((c) => ({ code: c.code, label: c.label, iconPath: c.iconPath })),
    stamps: stamps.map((s) => ({ code: s.code, label: s.label, iconPath: s.iconPath })),
    commentTemplates: commentTemplates.map((t) => ({ id: t.id, text: t.text })),
    levels: levels.map((l) => ({ level: l.level, requiredCount: l.requiredCount })),
  };
  const etag = `"${createHash("sha1").update(JSON.stringify(body)).digest("base64url")}"`;
  return { body, etag };
}
