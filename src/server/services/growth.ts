import type { TargetUnit } from "@/lib/constants";
import { buildGrowthSeries } from "@/lib/growth";
import type { GrowthData } from "@/lib/types";
import { prisma } from "../db";

export async function getGrowth(familyId: string): Promise<GrowthData> {
  const [children, categories, records] = await Promise.all([
    prisma.user.findMany({ where: { familyId, role: "CHILD", deletedAt: null }, select: { id: true, displayName: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.missionCategory.findMany({ where: { familyId }, select: { code: true, label: true }, orderBy: { label: "asc" } }),
    prisma.challenge.findMany({
      where: { familyId, status: "APPROVED", child: { familyId, role: "CHILD", deletedAt: null }, mission: { familyId, targetValue: { not: null }, targetUnit: { not: null } } },
      select: { id: true, childUserId: true, approvedAt: true, updatedAt: true, mission: { select: { title: true, categoryCode: true, targetValue: true, targetUnit: true, category: { select: { code: true, label: true } } } } },
      orderBy: [{ approvedAt: "asc" }, { id: "asc" }],
    }),
  ]);
  // 過去の共通カテゴリの記録も、その家族の実績がある場合だけ選択できる。
  const available = new Map(categories.map(category => [category.code, category]));
  for (const record of records) available.set(record.mission.categoryCode, record.mission.category);
  return {
    children,
    categories: [...available.values()],
    series: buildGrowthSeries(records.map(record => ({ id: record.id, childId: record.childUserId, categoryCode: record.mission.categoryCode, unit: record.mission.targetUnit as TargetUnit, value: record.mission.targetValue!, achievedAt: record.approvedAt ?? record.updatedAt, title: record.mission.title }))),
  };
}
