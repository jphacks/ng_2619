// ローカルのデモ2アカウントに、2026年9〜10月の上達記録を20件ずつ追加する。
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { v5 as uuid } from "uuid";
import { levelForCount } from "../server/domain/level";
import { toYmd, todayJst } from "../lib/date";

process.loadEnvFile(".env");
const db = new PrismaClient();
const startDay = Date.UTC(2026, 8, 1);
const specifications = [
  { loginId: "demo_taro", category: "リフティング", values: [2, 4, 7, 10, 14, 18, 23, 29, 36, 45], unit: "TIMES" },
  { loginId: "demo_taro", category: "なわとび", values: [8, 15, 25, 40, 60, 85], unit: "TIMES" },
  { loginId: "demo_taro", category: "水泳", values: [10, 20, 35, 50], unit: "METERS" },
  { loginId: "demo_hana", category: "なわとび", values: [1, 2, 4, 6, 9, 12, 16, 20, 25, 31, 38, 46, 55, 66, 80], unit: "TIMES" },
  { loginId: "demo_hana", category: "水泳", values: [3, 6, 10, 14, 18], unit: "METERS" },
] as const;

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "54329" || url.pathname !== "/kids_outdoor") throw new Error("標準のローカルDB専用です。");
  const parent = await db.user.findUniqueOrThrow({ where: { loginId: "demo_parent" } });
  const kids = await db.user.findMany({ where: { loginId: { in: ["demo_taro", "demo_hana"] }, familyId: parent.familyId, role: "CHILD", deletedAt: null } });
  assert.equal(parent.role, "PARENT");
  assert.equal(parent.deletedAt, null);
  assert.equal(kids.length, 2, "同じデモ家族の demo_taro と demo_hana が必要です。");
  const key = (name: string) => uuid(`kids-outdoor-progress-202609-202610/${parent.familyId}/${name}`, uuid.URL);
  const plan = specifications.flatMap(spec => {
    const child = kids.find(kid => kid.loginId === spec.loginId)!;
    // 54日間から重複なしで日付を選び、同じ種目では日付順に値が増えるようにする。
    const days = new Set<number>();
    while (days.size < spec.values.length) days.add(randomInt(54));
    const sorted = [...days].sort((a, b) => a - b);
    return spec.values.map((value, index) => ({
      child, category: spec.category, value, unit: spec.unit,
      id: key(`${child.id}/${spec.category}/${index}`),
      approvedAt: new Date(startDay + sorted[index] * 86400000 + randomInt(6, 10) * 3600000 + randomInt(60) * 60000),
    }));
  });
  assert.equal(plan.length, 40);
  const existing = await db.mission.count({ where: { id: { in: plan.map(row => row.id) } } });
  if (existing === 40) { console.log("このテスト用40件は投入済みです。重複追加はしていません。"); return; }
  assert.equal(existing, 0, "一部のテスト記録が既に存在するため、変更せず中止しました。");
  for (const spec of specifications) console.log(`${spec.loginId}: ${spec.category} ${spec.values.length}件 / ${spec.values[0]} → ${spec.values[spec.values.length - 1]}${spec.unit === "METERS" ? "m" : "回"}`);
  if (process.argv.includes("--dry-run")) { console.log("確認のみ。保存していません。"); return; }

  await db.$transaction(async tx => {
    const categories = new Map<string, string>();
    for (const label of ["リフティング", "なわとび", "水泳"]) {
      const category = await tx.missionCategory.upsert({ where: { familyId_label: { familyId: parent.familyId, label } }, update: {}, create: { code: key(`category/${label}`), familyId: parent.familyId, label, iconPath: "/icons/category-other.svg", sortOrder: 0 } });
      categories.set(label, category.code);
    }
    for (const row of plan) {
      const createdAt = new Date(row.approvedAt.getTime() - 3600000);
      const submittedAt = new Date(row.approvedAt.getTime() - 300000);
      const challengeId = key(`challenge/${row.id}`);
      await tx.mission.create({ data: { id: row.id, familyId: parent.familyId, createdBy: parent.id, title: `${row.category} ${row.value}${row.unit === "METERS" ? "m" : "回"}`, description: null, categoryCode: categories.get(row.category)!, targetValue: row.value, targetUnit: row.unit, verifyMethod: "EITHER", dueDate: new Date(`${todayJst(row.approvedAt)}T00:00:00Z`), createdAt, updatedAt: row.approvedAt } });
      await tx.challenge.create({ data: { id: challengeId, missionId: row.id, familyId: parent.familyId, childUserId: row.child.id, status: "APPROVED", approvedAt: row.approvedAt, createdAt, updatedAt: row.approvedAt } });
      await tx.submission.create({ data: { id: key(`submission/${row.id}`), challengeId, source: "PARENT", method: "VISUAL", submittedAt, reviewResult: "APPROVED", reviewerId: parent.id, reviewComment: "テスト用の記録です。", reviewedAt: row.approvedAt, childSeenAt: row.approvedAt } });
      await tx.activityDay.upsert({ where: { userId_date: { userId: row.child.id, date: new Date(`${todayJst(row.approvedAt)}T00:00:00Z`) } }, update: {}, create: { userId: row.child.id, date: new Date(`${todayJst(row.approvedAt)}T00:00:00Z`) } });
    }
    const levels = await tx.levelMaster.findMany({ orderBy: { level: "asc" } });
    assert.ok(levels.length > 0, "レベルマスタが必要です。");
    for (const kid of kids) {
      const approvedCount = await tx.challenge.count({ where: { childUserId: kid.id, status: "APPROVED" } });
      const level = levelForCount(levels, approvedCount);
      await tx.childProfile.update({ where: { userId: kid.id }, data: { approvedCount, level, lastSeenLevel: level } });
    }
    const saved = await tx.challenge.findMany({ where: { missionId: { in: plan.map(row => row.id) } }, include: { mission: { include: { category: true } } }, orderBy: { approvedAt: "asc" } });
    assert.equal(saved.length, 40);
    for (const spec of specifications) {
      const rows = saved.filter(row => row.childUserId === kids.find(kid => kid.loginId === spec.loginId)!.id && row.mission.category.label === spec.category);
      assert.deepEqual(rows.map(row => row.mission.targetValue), [...spec.values]);
      assert.ok(rows.every(row => row.mission.targetUnit === spec.unit && todayJst(row.approvedAt!) >= "2026-09-01" && todayJst(row.approvedAt!) <= "2026-10-24" && toYmd(row.mission.dueDate!) === todayJst(row.approvedAt!)));
    }
  }, { timeout: 30000 });
  console.log("完了: たろう20件・はな20件の達成記録を作成し、日付・単位・件数・上達順を検証しました。既存データとアカウントは保持しています。");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
