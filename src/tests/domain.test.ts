import { describe, expect, it } from "vitest";
import { isPastDue, startOfWeekJst, todayJst } from "@/lib/date";
import { levelForCount, remainingToNext, unlockedBetween } from "@/server/domain/level";
import { effectiveStatus, methodAllowed } from "@/server/domain/challenge";
import { buildLevels, AVATAR_ITEMS } from "@/prisma/seed-data";
import { AVATAR_SLOTS } from "@/lib/constants";
import { missionCreateSchema, childPasswordSchema, parentPasswordSchema } from "@/lib/schemas";

const levels = buildLevels();

describe("レベル（要件定義書 4.1.5）", () => {
  it("Lv.1〜10 の必要数と、Lv.11以降は+6・Lv.50=270", () => {
    expect(levels.slice(0, 10).map((l) => l.requiredCount)).toEqual([0, 1, 3, 5, 8, 11, 15, 19, 24, 30]);
    expect(levels.find((l) => l.level === 11)?.requiredCount).toBe(36);
    expect(levels.at(-1)).toEqual({ level: 50, requiredCount: 270 });
  });

  it("累計達成数からレベルを求める", () => {
    expect(levelForCount(levels, 0)).toBe(1);
    expect(levelForCount(levels, 1)).toBe(2);
    expect(levelForCount(levels, 2)).toBe(2);
    expect(levelForCount(levels, 30)).toBe(10);
    expect(levelForCount(levels, 9999)).toBe(50);
  });

  it("次のレベルまでの残り数（最大レベルは null）", () => {
    expect(remainingToNext(levels, 1, 0)).toBe(1);
    expect(remainingToNext(levels, 3, 4)).toBe(1);
    expect(remainingToNext(levels, 50, 300)).toBeNull();
  });

  it("レベルアップで解放されたパーツ", () => {
    const items = [{ unlockLevel: 1 }, { unlockLevel: 2 }, { unlockLevel: 3 }, { unlockLevel: 4 }];
    expect(unlockedBetween(items, 1, 3)).toEqual([{ unlockLevel: 2 }, { unlockLevel: 3 }]);
  });
});

describe("シードデータの検証（T-105, RK-09）", () => {
  it("Lv.2〜10 の各レベルで1つ以上パーツが解放される", () => {
    for (let lv = 2; lv <= 10; lv++) expect(AVATAR_ITEMS.some((i) => i.unlockLevel === lv)).toBe(true);
  });
  it("各スロットに初期パーツがある", () => {
    for (const slot of AVATAR_SLOTS) expect(AVATAR_ITEMS.some((i) => i.slot === slot && i.unlockLevel === 1)).toBe(true);
  });
});

describe("期限と状態", () => {
  it("日本時間の日付", () => {
    expect(todayJst(new Date("2026-10-24T14:59:59Z"))).toBe("2026-10-24");
    expect(todayJst(new Date("2026-10-24T15:00:00Z"))).toBe("2026-10-25");
  });
  it("期限日の当日はまだ期限内", () => {
    expect(isPastDue("2026-10-24", "2026-10-24")).toBe(false);
    expect(isPastDue("2026-10-23", "2026-10-24")).toBe(true);
    expect(isPastDue(null, "2026-10-24")).toBe(false);
  });
  it("期限を過ぎた OPEN/REJECTED は EXPIRED として扱う。PENDING は期限切れにしない（R-2）", () => {
    const due = new Date("2026-10-01T00:00:00Z");
    expect(effectiveStatus("OPEN", due, "2026-10-24")).toBe("EXPIRED");
    expect(effectiveStatus("REJECTED", due, "2026-10-24")).toBe("EXPIRED");
    expect(effectiveStatus("PENDING", due, "2026-10-24")).toBe("PENDING");
  });
  it("週の始まりは月曜（JST）", () => {
    // 2026-10-24 は土曜。月曜は 10-19 で、JST 0:00 = UTC 前日 15:00
    expect(startOfWeekJst(new Date("2026-10-24T03:00:00Z")).toISOString()).toBe("2026-10-18T15:00:00.000Z");
  });
  it("確認方法と申請方法", () => {
    expect(methodAllowed("EITHER", "VIDEO")).toBe(true);
    expect(methodAllowed("VIDEO", "VISUAL")).toBe(false);
    expect(methodAllowed("VISUAL", "VISUAL")).toBe(true);
  });
});

describe("入力チェック", () => {
  it("目標値だけの入力は回数として扱い、目標なしも許可する", () => {
    const base = { title: "a", categoryCode: "BALL", verifyMethod: "VIDEO", childIds: ["0192f3c4-0000-7000-8000-000000000000"] };
    expect(missionCreateSchema.safeParse({ ...base, targetValue: 50, targetUnit: "TIMES" }).success).toBe(true);
    expect(missionCreateSchema.parse({ ...base, targetValue: 50 }).targetUnit).toBe("TIMES");
    expect(missionCreateSchema.safeParse({ ...base, targetUnit: "TIMES" }).success).toBe(false);
    expect(missionCreateSchema.safeParse(base).success).toBe(true);
  });
  it("パスワードの強度", () => {
    expect(parentPasswordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(parentPasswordSchema.safeParse("abcd1234").success).toBe(true);
    expect(childPasswordSchema.safeParse("123456").success).toBe(true);
    expect(childPasswordSchema.safeParse("12345").success).toBe(false);
  });
});
