import { describe, expect, it } from "vitest";
import { buildGrowthSeries, type GrowthRecord } from "@/lib/growth";

const record = (overrides: Partial<GrowthRecord> = {}): GrowthRecord => ({ id: "a", childId: "taro", categoryCode: "swim", unit: "METERS", value: 10, achievedAt: new Date("2026-09-01T07:00:00Z"), title: "水泳10m", ...overrides });

describe("成長グラフの集計", () => {
  it("日本時間で日別最高値を採用し、日付順に並べる", () => {
    const [series] = buildGrowthSeries([
      record({ id: "later", achievedAt: new Date("2026-09-03T07:00:00Z"), value: 18 }),
      record({ id: "same-day-best", achievedAt: new Date("2026-09-01T15:10:00Z"), value: 14 }),
      record({ id: "same-day-small", achievedAt: new Date("2026-09-02T01:00:00Z"), value: 12 }),
      record(),
    ]);
    expect(series.recordCount).toBe(4);
    expect(series.points.map(point => [point.date, point.value])).toEqual([["2026-09-01", 10], ["2026-09-02", 14], ["2026-09-03", 18]]);
    expect(series.points[1].id).toBe("same-day-best");
  });

  it("子ども・カテゴリ・単位を混ぜない", () => {
    const series = buildGrowthSeries([
      record(), record({ childId: "hana", value: 3 }),
      record({ categoryCode: "rope", unit: "TIMES", value: 30 }),
      record({ unit: "TIMES", value: 2 }),
    ]);
    expect(series).toHaveLength(4);
    expect(series.every(item => item.points.length === 1 && item.recordCount === 1)).toBe(true);
  });

  it("空の記録では系列を生成しない", () => expect(buildGrowthSeries([])).toEqual([]));
});
