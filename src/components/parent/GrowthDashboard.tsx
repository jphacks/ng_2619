"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks";
import type { GrowthData } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass, Loading } from "@/components/ui";
import { GrowthChart } from "./GrowthChart";

export function GrowthDashboard() {
  const { data, error, loading, reload } = useApi<GrowthData>("/parent/growth");
  const [selectedChildId, setChildId] = useState<string | null>(null);
  const [selectedCategoryCode, setCategoryCode] = useState<string | null>(null);
  const child = data?.children.find(item => item.id === selectedChildId) ?? data?.children[0];
  const defaultCategory = data?.series.find(item => item.childId === child?.id)?.categoryCode;
  const category = data?.categories.find(item => item.code === selectedCategoryCode) ?? data?.categories.find(item => item.code === defaultCategory) ?? data?.categories[0];
  const series = data?.series.filter(item => item.childId === child?.id && item.categoryCode === category?.code) ?? [];

  return <Card className="space-y-4">
    <div><h2 className="text-lg font-bold">お子さまの成長</h2><p className="mt-1 text-sm text-muted">子どもとカテゴリを選ぶと、この画面でグラフが切り替わります。</p></div>
    {loading && !data ? <Loading label="成長の記録を読み込み中…" /> : error ? <><ErrorBanner message={error.message} /><Button variant="secondary" onClick={() => void reload()}>再読み込み</Button></> : !child ? <p className="text-sm text-muted">お子さまを登録すると成長の記録を確認できます。</p> : <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="成長を見る子ども">{id => <select id={id} className={inputClass()} value={child.id} onChange={event => setChildId(event.target.value)}>{data!.children.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select>}</Field>
        <Field label="成長を見るカテゴリ">{id => <select id={id} className={inputClass()} disabled={!category} value={category?.code ?? ""} onChange={event => setCategoryCode(event.target.value)}>{!category && <option value="">カテゴリがありません</option>}{data!.categories.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select>}</Field>
      </div>
      {series.length > 0 ? <>
        <h3 className="font-bold">{child.displayName}の{category!.label}</h3>
        <p className="text-xs text-muted">達成したミッションの目標値から、日ごとの最高値を表示しています。点を押すと日付と記録を確認できます。</p>
        {series.map(item => <GrowthChart key={`${item.childId}/${item.categoryCode}/${item.unit}`} series={item} childName={child.displayName} categoryName={category!.label} />)}
      </> : <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-muted">この子ども・カテゴリには、数値付きの達成記録がまだありません。</p>}
    </>}
  </Card>;
}
