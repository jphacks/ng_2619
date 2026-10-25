"use client";

import { useEffect, useRef, useState } from "react";
import { TARGET_UNIT_LABEL } from "@/lib/constants";
import type { GrowthSeries } from "@/lib/types";

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`);
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export function GrowthChart({ series, childName, categoryName }: { series: GrowthSeries; childName: string; categoryName: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(280, Math.round(entries[0].contentRect.width))));
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, []);
  const { points } = series;
  const first = points[0];
  const latest = points[points.length - 1];
  const selected = points.find(point => point.id === selectedId) ?? latest;
  const unit = TARGET_UNIT_LABEL[series.unit];
  const best = Math.max(...points.map(point => point.value));
  const growth = latest.value - first.value;
  const height = 320;
  const left = 64, right = width - 24, top = 28, bottom = height - 48;
  const rawStep = best / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, rawStep)));
  const tick = [1, 2, 2.5, 5, 10].map(value => value * magnitude).find(value => value >= rawStep) ?? magnitude * 10;
  const maximum = Math.max(tick, Math.ceil(best / tick) * tick);
  const x = (date: string) => points.length === 1 ? (left + right) / 2 : left + (dayNumber(date) - dayNumber(first.date)) / (dayNumber(latest.date) - dayNumber(first.date)) * (right - left);
  const y = (value: number) => bottom - value / maximum * (bottom - top);
  const tickCount = points.length === 1 ? 1 : width < 420 ? 3 : 4;
  const dates = Array.from({ length: tickCount }, (_, index) => new Date(dayNumber(first.date) + Math.round((dayNumber(latest.date) - dayNumber(first.date)) / 86400000 * index / Math.max(1, tickCount - 1)) * 86400000).toISOString().slice(0, 10));
  const path = points.map(point => `${x(point.date)},${y(point.value)}`).join(" ");

  return <section className="space-y-3" aria-label={`${childName}の${categoryName}（${unit}）の成長`}>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[["初回", `${first.value}${unit}`], ["最新", `${latest.value}${unit}`], ["最高", `${best}${unit}`], ["初回からの変化", `${growth > 0 ? "+" : ""}${growth}${unit}`]].map(([label, value]) => <div key={label} className="rounded-xl bg-parent-soft p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-bold text-parent-primary">{value}</p></div>)}
    </div>
    <p className="text-sm text-muted">{first.date.replaceAll("-", "/")}〜{latest.date.replaceAll("-", "/")} ・ {series.recordCount}件の達成</p>
    <svg ref={chart} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${childName}の${categoryName}の折れ線グラフ（${unit}）`} className="w-full overflow-visible rounded-xl bg-slate-50">
      <title>{childName}の{categoryName}：{first.value}{unit}から{latest.value}{unit}</title>
      <text x={left} y={17} fontSize={13} fill="#64748b">{unit}</text>
      {Array.from({ length: Math.round(maximum / tick) + 1 }, (_, index) => index * tick).map(value => <g key={value}>
        <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#dce5df" />
        <text x={left - 10} y={y(value) + 5} textAnchor="end" fontSize={14} fill="#64748b">{value}</text>
      </g>)}
      <line x1={left} x2={left} y1={top} y2={bottom} stroke="#94a3b8" />
      {[...new Set(dates)].map(date => <text key={date} x={x(date)} y={bottom + 26} textAnchor="middle" fontSize={14} fill="#64748b">{shortDate(date)}</text>)}
      <text x={(left + right) / 2} y={height - 4} textAnchor="middle" fontSize={13} fill="#64748b">達成日</text>
      {points.length > 1 && <><polygon points={`${left},${bottom} ${path} ${right},${bottom}`} fill="#dcfce7" opacity={0.6} /><polyline points={path} fill="none" stroke="#15803d" strokeWidth={3} strokeLinejoin="round" /></>}
      {points.map(point => <g key={point.id}>
        <circle cx={x(point.date)} cy={y(point.value)} r={selected.id === point.id ? 6 : 4} fill={selected.id === point.id ? "#166534" : "#22c55e"} stroke="white" strokeWidth={2} />
        <circle cx={x(point.date)} cy={y(point.value)} r={15} fill="transparent" role="button" tabIndex={0} aria-pressed={selected.id === point.id} aria-label={`${point.date} ${point.value}${unit}`} className="cursor-pointer focus:outline-2 focus:outline-parent-primary" onMouseEnter={() => setSelectedId(point.id)} onFocus={() => setSelectedId(point.id)} onClick={() => setSelectedId(point.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(point.id); } }}>
          <title>{point.date}：{point.value}{unit}</title>
        </circle>
      </g>)}
    </svg>
    <p aria-live="polite" className="rounded-xl bg-green-50 px-3 py-2 text-sm"><span className="font-bold">{selected.date.replaceAll("-", "/")}：{selected.value}{unit}</span><span className="ml-2 text-muted">{selected.title}</span></p>
    <details className="text-sm">
      <summary className="cursor-pointer py-2 font-bold text-parent-primary">記録を一覧で見る（{points.length}日分）</summary>
      <table className="mt-2 w-full text-left"><caption className="sr-only">{childName}の{categoryName}の日別最高記録</caption><thead><tr className="border-b"><th className="py-2">達成日</th><th className="py-2 text-right">記録（{unit}）</th></tr></thead><tbody>{points.map(point => <tr key={point.id} className="border-b border-slate-100"><td className="py-2">{point.date.replaceAll("-", "/")}</td><td className="text-right tabular-nums">{point.value}{unit}</td></tr>)}</tbody></table>
    </details>
  </section>;
}
