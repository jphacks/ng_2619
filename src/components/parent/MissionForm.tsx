"use client";

import { useEffect, useId, useRef, useState } from "react";
import { type TargetUnit, type VerifyMethod } from "@/lib/constants";
import { todayJst } from "@/lib/date";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ChildCard, Masters, MissionDetail } from "@/lib/types";
import { Button, ErrorBanner, Field, inputClass } from "@/components/ui";

type Category = Masters["categories"][number];
export type MissionFormValues = {
  title: string;
  description: string;
  categoryCode: string;
  targetValue: string;
  targetUnit: TargetUnit | "";
  verifyMethod: VerifyMethod;
  dueDate: string;
  childIds: string[];
};
export const emptyMission: MissionFormValues = {
  title: "", description: "", categoryCode: "", targetValue: "", targetUnit: "", verifyMethod: "EITHER", dueDate: "", childIds: [],
};

export function MissionForm({ mode, initial, childOptions, editable, error, fieldErrors, busy, onSubmit }: {
  mode: "create" | "edit";
  initial: MissionFormValues;
  childOptions?: ChildCard[];
  editable?: MissionDetail["editable"];
  error: string | null;
  fieldErrors: Record<string, string>;
  busy: boolean;
  onSubmit: (v: MissionFormValues) => void;
}) {
  const { data: categories, error: categoryLoadError, loading: categoriesLoading, setData: setCategories, reload } = useApi<{ items: Category[] }>(mode === "create" ? "/categories" : null);
  const [v, setV] = useState<MissionFormValues>(initial);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const categoryEditorId = useId();
  const categoryInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (categoryEditorOpen) categoryInput.current?.focus();
  }, [categoryEditorOpen]);
  const set = <K extends keyof MissionFormValues>(k: K, value: MissionFormValues[K]) => setV(s => ({ ...s, [k]: value }));
  const isEdit = mode === "edit";
  const locked = isEdit && editable && !editable.allowed;

  async function addCategory() {
    const label = categoryName.trim();
    if (!label) { setCategoryError("カテゴリ名を入力してください"); return; }
    setAddingCategory(true);
    setCategoryError(null);
    try {
      const category = await api<Category>("/categories", { method: "POST", body: { label } });
      setCategories(previous => ({ items: [...(previous?.items ?? []).filter(item => item.code !== category.code), category] }));
      set("categoryCode", category.code);
      setCategoryName("");
      setCategoryEditorOpen(false);
    } catch (cause) {
      setCategoryError(cause instanceof ApiError ? cause.message : "カテゴリを追加できませんでした");
    } finally { setAddingCategory(false); }
  }

  return (
    <form className="space-y-5" onSubmit={event => { event.preventDefault(); if (!addingCategory) onSubmit(v); }}>
      <ErrorBanner message={error} />
      {isEdit && editable?.reason && <p className="rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">{editable.reason}</p>}
      <fieldset disabled={!!locked || busy} className="space-y-5">
        <Field label="タイトル（必須）" hint="漢字で入力できます。子どもの学年に合わせて自動表示します。本名や学校名は書かないでください" error={fieldErrors.title}>
          {(id, d) => <input id={id} aria-describedby={d} className={inputClass("parent", !!fieldErrors.title)} value={v.title} onChange={event => set("title", event.target.value)} maxLength={30} placeholder="なわとび" required />}
        </Field>
        {!isEdit && <section className="space-y-3" aria-label="カテゴリ">
          <div className="flex items-center justify-between gap-3">
            <p className="text-left text-sm font-bold">カテゴリ（必須）</p>
            <Button variant="secondary" className="shrink-0 min-h-8! px-2! text-sm! rounded-lg!" aria-expanded={categoryEditorOpen} aria-controls={categoryEditorId} disabled={addingCategory || categoriesLoading || !!categoryLoadError} onClick={() => { setCategoryError(null); setCategoryEditorOpen(open => !open); }}>カテゴリを追加</Button>
          </div>
          {categoriesLoading && <p className="text-sm text-muted">カテゴリを読み込み中…</p>}
          {categoryLoadError && <><ErrorBanner message={categoryLoadError.message} /><Button variant="secondary" onClick={() => void reload()}>再読み込み</Button></>}
          {categories && categories.items.length === 0 && <p className="text-sm text-muted">カテゴリを追加してください。</p>}
          <div className="flex flex-wrap gap-2">
            {categories?.items.map(category => <button key={category.code} type="button" aria-pressed={v.categoryCode === category.code} onClick={() => set("categoryCode", category.code)} className={`min-h-12 rounded-xl border px-4 text-sm font-bold ${v.categoryCode === category.code ? "border-parent-primary bg-parent-soft text-parent-primary-dark" : "border-line bg-white"}`}>{category.label}</button>)}
          </div>
          {categoryEditorOpen && <div id={categoryEditorId} className="space-y-3">
            <Field label="新しいカテゴリ" hint="20文字まで（例：運動、お手伝い）" error={categoryError ?? undefined}>
              {(id, d) => <input ref={categoryInput} id={id} aria-describedby={d} className={inputClass()} value={categoryName} onChange={event => setCategoryName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); if (!addingCategory && !categoriesLoading && !categoryLoadError) void addCategory(); } }} maxLength={20} placeholder="カテゴリ名を入力" disabled={addingCategory} />}
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={addingCategory} onClick={() => void addCategory()}>{addingCategory ? "追加中…" : "追加する"}</Button>
              <Button variant="ghost" disabled={addingCategory} onClick={() => { setCategoryEditorOpen(false); setCategoryName(""); setCategoryError(null); }}>キャンセル</Button>
            </div>
          </div>}
          {fieldErrors.categoryCode && <p role="alert" className="text-sm font-bold text-danger">{fieldErrors.categoryCode}</p>}
        </section>}
        {!isEdit && <Field label="目標値" hint="任意・1〜9999（回数）" error={fieldErrors.targetValue}>
          {(id, d) => <input id={id} aria-describedby={d} className={inputClass()} inputMode="numeric" value={v.targetValue} onChange={event => set("targetValue", event.target.value.replace(/[^0-9]/g, ""))} placeholder="50" />}
        </Field>}
        <Field label="期限日" hint="空欄なら期限なし" error={fieldErrors.dueDate}>
          {(id, d) => <input id={id} aria-describedby={d} type="date" className={inputClass()} min={todayJst()} value={v.dueDate} onChange={event => set("dueDate", event.target.value)} />}
        </Field>
        {!isEdit && <div className="space-y-2">
          <p className="text-sm font-bold">割り当てる子ども（必須）</p>
          {childOptions?.length === 0 && <p className="text-sm text-muted">先にお子さまのアカウントを作成してください。</p>}
          <div className="flex flex-wrap gap-2">
            {childOptions?.map(child => <label key={child.id} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 ${v.childIds.includes(child.id) ? "border-parent-primary bg-parent-soft" : "border-line bg-white"}`}>
              <input type="checkbox" className="h-5 w-5" checked={v.childIds.includes(child.id)} onChange={() => set("childIds", v.childIds.includes(child.id) ? v.childIds.filter(id => id !== child.id) : [...v.childIds, child.id])} />{child.displayName}
            </label>)}
          </div>
          {fieldErrors.childIds && <p className="text-sm font-bold text-danger">{fieldErrors.childIds}</p>}
        </div>}
      </fieldset>
      {!locked && <Button type="submit" block disabled={busy || addingCategory}>{busy ? "保存中…" : isEdit ? "保存する" : "ミッションを作る"}</Button>}
    </form>
  );
}

export function toCreateBody(v: MissionFormValues) {
  return {
    title: v.title, description: null, categoryCode: v.categoryCode,
    targetValue: v.targetValue ? Number(v.targetValue) : null,
    targetUnit: v.targetValue ? "TIMES" : null,
    verifyMethod: "EITHER", dueDate: v.dueDate || null, childIds: v.childIds,
  };
}
