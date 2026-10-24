// P-01 保護者ホーム（F-APV-01, F-APV-06）
import type { ParentDashboard } from "@/lib/types";
import { prisma } from "../db";
import { listChildCards } from "./children";
import { countPending } from "./reviews";

export async function parentDashboard(familyId: string): Promise<ParentDashboard> {
  const [pendingCount, children] = await Promise.all([countPending(prisma, familyId), listChildCards(prisma, familyId)]);
  return { pendingCount, children };
}
