// アバター（F-AVT-01〜04、基本設計書 4.5）
// 解放済みパーツは「unlock_level <= 子どものレベル」で毎回求める（DC-01）。

import { AVATAR_SLOTS, type AvatarSlot } from "@/lib/constants";
import type { AvatarLayer, AvatarState } from "@/lib/types";
import { prisma, type Db } from "../db";
import { errors } from "../errors";

const slotOrder = (slot: string) => AVATAR_SLOTS.indexOf(slot as AvatarSlot);

/** 子どもごとの装備（重ね順に並べたレイヤー） */
export async function loadAvatarLayers(db: Db, childUserIds: string[]): Promise<Map<string, AvatarLayer[]>> {
  const equips = await db.avatarEquip.findMany({
    where: { childUserId: { in: childUserIds } },
    include: { item: true },
  });
  const map = new Map<string, AvatarLayer[]>(childUserIds.map((id) => [id, []]));
  for (const e of equips) {
    map.get(e.childUserId)?.push({
      slot: e.slot as AvatarSlot,
      itemId: e.itemId,
      imagePath: e.item.imagePath,
      isNone: e.item.isNone,
    });
  }
  for (const layers of map.values()) layers.sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
  return map;
}

/** 子どもアカウント作成時の初期装備：各スロットで unlock_level=1 かつ sort_order が最小のパーツ */
export async function createDefaultEquips(db: Db, childUserId: string): Promise<void> {
  const items = await db.avatarItem.findMany({ where: { unlockLevel: 1 }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const first = new Map<string, string>();
  for (const item of items) if (!first.has(item.slot)) first.set(item.slot, item.id);
  const missing = AVATAR_SLOTS.filter((s) => !first.has(s));
  if (missing.length > 0) throw new Error(`初期パーツがないスロットがあります: ${missing.join(",")}`);
  await db.avatarEquip.createMany({
    data: AVATAR_SLOTS.map((slot) => ({ childUserId, slot, itemId: first.get(slot)! })),
  });
}

export async function getAvatarState(childUserId: string): Promise<AvatarState> {
  const profile = await prisma.childProfile.findUniqueOrThrow({ where: { userId: childUserId } });
  const [items, equips] = await Promise.all([
    prisma.avatarItem.findMany({ orderBy: [{ slot: "asc" }, { sortOrder: "asc" }] }),
    prisma.avatarEquip.findMany({ where: { childUserId } }),
  ]);
  return {
    level: profile.level,
    items: items.map((i) => ({
      id: i.id,
      slot: i.slot as AvatarSlot,
      name: i.name,
      imagePath: i.imagePath,
      unlockLevel: i.unlockLevel,
      isNone: i.isNone,
      unlocked: i.unlockLevel <= profile.level,
    })),
    equips: Object.fromEntries(equips.map((e) => [e.slot, e.itemId])) as Record<AvatarSlot, string>,
  };
}

/** 装備を保存する。スロットとパーツの対応、解放済みかどうかをサーバで確認する */
export async function updateAvatar(childUserId: string, equips: Partial<Record<AvatarSlot, string>>): Promise<AvatarState> {
  const missing = AVATAR_SLOTS.filter((s) => !equips[s]);
  if (missing.length > 0) throw errors.validation("すべての パーツを えらんでね");

  await prisma.$transaction(async (tx) => {
    const profile = await tx.childProfile.findUniqueOrThrow({ where: { userId: childUserId } });
    const ids = AVATAR_SLOTS.map((s) => equips[s]!);
    const items = await tx.avatarItem.findMany({ where: { id: { in: ids } } });
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const slot of AVATAR_SLOTS) {
      const item = byId.get(equips[slot]!);
      if (!item || item.slot !== slot) throw errors.validation("パーツの くみあわせが ただしくないよ");
      if (item.unlockLevel > profile.level) throw errors.validation("まだ つかえない パーツだよ");
    }
    for (const slot of AVATAR_SLOTS) {
      await tx.avatarEquip.upsert({
        where: { childUserId_slot: { childUserId, slot } },
        create: { childUserId, slot, itemId: equips[slot]! },
        update: { itemId: equips[slot]! },
      });
    }
    if (!profile.avatarInitialized) {
      await tx.childProfile.update({ where: { userId: childUserId }, data: { avatarInitialized: true } });
    }
  });
  return getAvatarState(childUserId);
}
