import { prisma } from "../db";
import { newId } from "../ids";

export async function listCategories(familyId: string) {
  return prisma.missionCategory.findMany({ where: { familyId }, orderBy: [{ label: "asc" }, { code: "asc" }], select: { code: true, label: true, iconPath: true } });
}

export async function addCategory(familyId: string, label: string) {
  // 同時クリックでも同じ名前のカテゴリを一つだけ作る（DBの一意制約で処理）。
  await prisma.missionCategory.createMany({
    data: [{ code: newId(), familyId, label, iconPath: "/icons/category-other.svg", sortOrder: 0 }],
    skipDuplicates: true,
  });
  return prisma.missionCategory.findUniqueOrThrow({
    where: { familyId_label: { familyId, label } },
    select: { code: true, label: true, iconPath: true },
  });
}
