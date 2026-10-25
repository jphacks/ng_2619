import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { GET } from "@/app/api/v1/parent/growth/route";
import { prisma } from "@/server/db";
import { createSession } from "@/server/auth/session";

it("成長APIは自分の家族の数値付き達成記録だけを返す", async () => {
  const familyA = randomUUID(), familyB = randomUUID();
  const parentA = randomUUID(), parentB = randomUUID(), childA = randomUUID(), childB = randomUUID(), deletedChild = randomUUID();
  const categoryA = randomUUID(), categoryB = randomUUID();
  const suffix = familyA.slice(0, 8);
  await prisma.family.createMany({ data: [{ id: familyA }, { id: familyB }] });
  try {
    await prisma.user.createMany({ data: [
      { id: parentA, familyId: familyA, loginId: `ga_${suffix}`, role: "PARENT", displayName: "おやA", email: "a@example.com", passwordHash: "unused" },
      { id: parentB, familyId: familyB, loginId: `gb_${suffix}`, role: "PARENT", displayName: "おやB", email: "b@example.com", passwordHash: "unused" },
      { id: childA, familyId: familyA, loginId: `gka_${suffix}`, role: "CHILD", displayName: "たろう", passwordHash: "unused" },
      { id: childB, familyId: familyB, loginId: `gkb_${suffix}`, role: "CHILD", displayName: "ほかの子", passwordHash: "unused" },
      { id: deletedChild, familyId: familyA, loginId: `gkd_${suffix}`, role: "CHILD", displayName: "削除済み", passwordHash: "unused", deletedAt: new Date() },
    ] });
    await prisma.missionCategory.createMany({ data: [{ code: categoryA, familyId: familyA, label: "水泳", iconPath: "", sortOrder: 0 }, { code: categoryB, familyId: familyB, label: "秘密のカテゴリ", iconPath: "", sortOrder: 0 }] });
    async function add(value: number | null, date: string, status = "APPROVED", unit = "METERS", childId = childA, familyId = familyA) {
      const missionId = randomUUID();
      await prisma.mission.create({ data: { id: missionId, familyId, createdBy: familyId === familyA ? parentA : parentB, title: "水泳", categoryCode: familyId === familyA ? categoryA : categoryB, verifyMethod: "EITHER", targetValue: value, targetUnit: value === null ? null : unit } });
      await prisma.challenge.create({ data: { id: randomUUID(), familyId, childUserId: childId, missionId, status, approvedAt: new Date(`${date}T07:00:00Z`) } });
    }
    await add(10, "2026-09-01"); await add(20, "2026-09-02"); await add(15, "2026-09-02");
    await add(50, "2026-09-02", "APPROVED", "TIMES");
    await add(100, "2026-09-03", "PENDING"); await add(null, "2026-09-03");
    await add(300, "2026-09-03", "APPROVED", "METERS", deletedChild);
    await add(999, "2026-09-03", "APPROVED", "METERS", childB, familyB);
    const parent = await createSession(prisma, parentA, "PARENT", null);
    const child = await createSession(prisma, childA, "CHILD", null);
    const args = { params: Promise.resolve({}) };
    const request = (cookie?: string) => new Request("http://localhost:3000/api/v1/parent/growth", { headers: cookie ? { cookie } : {} });
    expect((await GET(request(), args)).status).toBe(401);
    expect((await GET(request(`sid_child=${child.token}`), args)).status).toBe(401);
    const response = await GET(request(`sid_parent=${parent.token}`), args);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.children).toEqual([{ id: childA, displayName: "たろう" }]);
    expect(data.categories).toEqual([{ code: categoryA, label: "水泳" }]);
    expect(data.series).toHaveLength(2);
    expect(data.series.find((series: { unit: string }) => series.unit === "METERS").points.map((point: { value: number }) => point.value)).toEqual([10, 20]);
    expect(data.series.find((series: { unit: string }) => series.unit === "TIMES").points[0].value).toBe(50);
  } finally {
    await prisma.mission.deleteMany({ where: { familyId: { in: [familyA, familyB] } } });
    await prisma.family.deleteMany({ where: { id: { in: [familyA, familyB] } } });
  }
});
