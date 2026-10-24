// シードデータ投入（T-104）。何度実行しても同じ結果になる（upsert）。
// SEED_DEMO=1 を付けると、デモ用の保護者・子ども・ミッションも作る。

import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { v7 } from "uuid";
import {
  AVATAR_ITEMS,
  avatarImagePath,
  buildLevels,
  CATEGORIES,
  categoryIconPath,
  COMMENT_TEMPLATES,
  SAFETY_MESSAGES,
  STAMPS,
  stampIconPath,
} from "./seed-data";

const prisma = new PrismaClient();

async function seedMasters() {
  for (const l of buildLevels()) {
    await prisma.levelMaster.upsert({ where: { level: l.level }, create: l, update: { requiredCount: l.requiredCount } });
  }
  for (const c of CATEGORIES) {
    const data = { label: c.label, iconPath: categoryIconPath(c.code), sortOrder: c.sortOrder };
    await prisma.missionCategory.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data });
  }
  for (const s of STAMPS) {
    const data = { label: s.label, iconPath: stampIconPath(s.code), sortOrder: s.sortOrder };
    await prisma.stamp.upsert({ where: { code: s.code }, create: { code: s.code, ...data }, update: data });
  }
  await prisma.commentTemplate.deleteMany();
  await prisma.commentTemplate.createMany({ data: COMMENT_TEMPLATES.map((text, i) => ({ text, sortOrder: i + 1 })) });
  await prisma.safetyMessage.deleteMany();
  await prisma.safetyMessage.createMany({ data: SAFETY_MESSAGES.map((text, i) => ({ text, sortOrder: i + 1 })) });

  let order = 0;
  for (const item of AVATAR_ITEMS) {
    const data = {
      slot: item.slot,
      name: item.name,
      imagePath: avatarImagePath(item.id),
      unlockLevel: item.unlockLevel,
      isNone: item.isNone ?? false,
      sortOrder: ++order,
    };
    await prisma.avatarItem.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
  }
}

const HASH_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

async function seedDemo() {
  if (await prisma.user.findUnique({ where: { loginId: "demo_parent" } })) {
    console.log("demo data already exists");
    return;
  }
  const familyId = v7();
  const parentId = v7();
  await prisma.family.create({ data: { id: familyId } });
  await prisma.user.create({
    data: {
      id: parentId,
      familyId,
      role: "PARENT",
      loginId: "demo_parent",
      passwordHash: await hash("demo1234", HASH_OPTIONS),
      displayName: "おとうさん",
      email: "demo-parent@example.com",
      parentSettings: { create: { termsAgreedAt: new Date(), termsVersion: "demo" } },
    },
  });
  const kids = [
    { loginId: "demo_taro", name: "たろう", grade: 2 },
    { loginId: "demo_hana", name: "はな", grade: 1 },
  ];
  const defaults = ["bg_park", "bottom_shorts_blue", "top_tshirt_red", "face_smile_light", "hair_short_black", "hat_none", "item_none"];
  const kidIds: string[] = [];
  for (const k of kids) {
    const id = v7();
    kidIds.push(id);
    await prisma.user.create({
      data: {
        id,
        familyId,
        role: "CHILD",
        loginId: k.loginId,
        passwordHash: await hash("123456", HASH_OPTIONS),
        displayName: k.name,
        childProfile: { create: { grade: k.grade } },
      },
    });
    await prisma.avatarEquip.createMany({
      data: defaults.map((itemId) => ({ childUserId: id, slot: AVATAR_ITEMS.find((a) => a.id === itemId)!.slot, itemId })),
    });
  }
  const missions = [
    { title: "リフティング 50かい", description: "ボールを じめんに おとさずに 50かい つづけよう", categoryCode: "BALL", targetValue: 50, targetUnit: "TIMES", verifyMethod: "VIDEO" },
    { title: "さかあがり", description: "てつぼうで さかあがりを しよう", categoryCode: "BAR", targetValue: null, targetUnit: null, verifyMethod: "EITHER" },
    { title: "なわとび 30かい", description: "とまらずに 30かい とぼう", categoryCode: "ROPE", targetValue: 30, targetUnit: "TIMES", verifyMethod: "VISUAL" },
  ];
  for (const m of missions) {
    const missionId = v7();
    await prisma.mission.create({ data: { id: missionId, familyId, createdBy: parentId, ...m } });
    await prisma.challenge.createMany({
      data: kidIds.map((childUserId) => ({ id: v7(), missionId, familyId, childUserId, status: "OPEN" })),
    });
  }
  console.log("demo data: demo_parent / demo1234, demo_taro / 123456, demo_hana / 123456");
}

async function main() {
  await seedMasters();
  console.log("masters seeded");
  if (process.env.SEED_DEMO === "1") await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
