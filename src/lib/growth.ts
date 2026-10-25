import type { TargetUnit } from "./constants";
import { todayJst } from "./date";
import type { GrowthSeries } from "./types";

export type GrowthRecord = {
  id: string;
  childId: string;
  categoryCode: string;
  unit: TargetUnit;
  value: number;
  achievedAt: Date;
  title: string;
};

/** 家族の取得済み記録を子ども・カテゴリ・単位で分け、日本時間の日別最高値にまとめる。 */
export function buildGrowthSeries(records: GrowthRecord[]): GrowthSeries[] {
  const groups = new Map<string, GrowthSeries>();
  for (const row of records) {
    const key = JSON.stringify([row.childId, row.categoryCode, row.unit]);
    let group = groups.get(key);
    if (!group) {
      group = { childId: row.childId, categoryCode: row.categoryCode, unit: row.unit, recordCount: 0, points: [] };
      groups.set(key, group);
    }
    group.recordCount++;
    const date = todayJst(row.achievedAt);
    const previous = group.points.find(point => point.date === date);
    if (!previous) group.points.push({ id: row.id, date, value: row.value, title: row.title });
    else if (row.value > previous.value) Object.assign(previous, { id: row.id, value: row.value, title: row.title });
  }
  for (const group of groups.values()) group.points.sort((a, b) => a.date.localeCompare(b.date));
  return [...groups.values()];
}
