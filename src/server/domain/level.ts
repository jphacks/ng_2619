// レベル計算（基本設計書 4.5）。承認（F-APV-04）と直接登録（F-APV-08）の両方から呼ぶ（R-8, NF-E-05）。

import type { Db } from "../db";

export type LevelRow = { level: number; requiredCount: number };

export type ApprovalResult = { approvedCount: number; level: number; previousLevel: number; leveledUp: boolean };

/**
 * 累計達成数を＋1してレベルを再計算する。トランザクションの中で呼ぶこと。
 * child_profiles の行ロックで、同じ子どもへの同時承認を直列化する。
 */
export async function addApproval(db: Db, childUserId: string): Promise<ApprovalResult> {
  const rows = await db.$queryRaw<{ approved_count: number; level: number; old_level: number }[]>`
    WITH old AS (
      SELECT level FROM child_profiles WHERE user_id = ${childUserId}::uuid FOR UPDATE
    )
    UPDATE child_profiles c
    SET approved_count = c.approved_count + 1,
        level = GREATEST(
          c.level,
          COALESCE((SELECT MAX(l.level) FROM level_master l WHERE l.required_count <= c.approved_count + 1), c.level)
        )
    FROM old
    WHERE c.user_id = ${childUserId}::uuid
    RETURNING c.approved_count, c.level, old.level AS old_level`;
  const row = rows[0];
  if (!row) throw new Error(`child_profiles not found: ${childUserId}`);
  const level = Number(row.level);
  const previousLevel = Number(row.old_level);
  return { approvedCount: Number(row.approved_count), level, previousLevel, leveledUp: level > previousLevel };
}

/** 累計達成数に対するレベル（表示・テスト用） */
export function levelForCount(levels: LevelRow[], count: number): number {
  let result = 1;
  for (const l of levels) if (l.requiredCount <= count && l.level > result) result = l.level;
  return result;
}

/** 次のレベルまでの残り数。最大レベルなら null */
export function remainingToNext(levels: LevelRow[], level: number, approvedCount: number): number | null {
  const next = levels.find((l) => l.level === level + 1);
  if (!next) return null;
  return Math.max(0, next.requiredCount - approvedCount);
}

/** fromExclusive < unlockLevel <= toInclusive のパーツ（レベルアップ演出で見せる。DC-01） */
export function unlockedBetween<T extends { unlockLevel: number }>(items: T[], fromExclusive: number, toInclusive: number): T[] {
  return items.filter((i) => i.unlockLevel > fromExclusive && i.unlockLevel <= toInclusive);
}

let cache: { at: number; rows: LevelRow[] } | null = null;

/** レベルマスタ（60秒キャッシュ） */
export async function getLevels(db: Db): Promise<LevelRow[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.rows;
  const rows = await db.levelMaster.findMany({ orderBy: { level: "asc" } });
  cache = { at: Date.now(), rows: rows.map((r) => ({ level: r.level, requiredCount: r.requiredCount })) };
  return cache.rows;
}
