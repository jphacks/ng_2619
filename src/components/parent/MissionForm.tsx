"use client";

// P-03 ミッション作成・編集フォーム（F-MIS-01, 03。要件定義書 4.1.2）
import { useState } from "react";
import {
  TARGET_UNIT_LABEL,
  TARGET_UNITS,
  VERIFY_METHOD_LABEL,
  VERIFY_METHODS,
  type TargetUnit,
  type VerifyMethod,
} from "@/lib/constants";
import { todayJst } from "@/lib/date";
import { kidsLabel, formatMonthDayForGrade } from "@/lib/kids-labels";
import { useApi } from "@/lib/hooks";
import type { ChildCard, Masters, MissionDetail } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";
import { CATEGORY_EMOJI } from "@/components/StatusBadge";
import { MissionTextPreview } from "./MissionTextPreview";
import { targetUnitForGrade } from "@/lib/kanji-grades";

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
  title: "",
  description: "",
  categoryCode: "",
  targetValue: "",
  targetUnit: "",
  verifyMethod: "EITHER",
  dueDate: "",
  childIds: [],
};

export function MissionForm({
  mode,
  initial,
  childOptions,
  editable,
  error,
  fieldErrors,
  busy,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: MissionFormValues;
  childOptions?: ChildCard[];
  editable?: MissionDetail["editable"];
  error: string | null;
  fieldErrors: Record<string, string>;
  busy: boolean;
  onSubmit: (v: MissionFormValues) => void;
}) {
  const { data: masters } = useApi<Masters>("/masters");
  const [v, setV] = useState<MissionFormValues>(initial);
  const [previewGrade, setPreviewGrade] = useState<number | null>(null);
  const grade = previewGrade ?? childOptions?.find(c => v.childIds.includes(c.id))?.grade ?? 1;
  const set = <K extends keyof MissionFormValues>(k: K, value: MissionFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const isEdit = mode === "edit";
  const locked = isEdit && editable && !editable.allowed;

  function toggleChild(id: string) {
    set("childIds", v.childIds.includes(id) ? v.childIds.filter((c) => c !== id) : [...v.childIds, id]);
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <ErrorBanner message={error} />
      {isEdit && editable?.reason && (
        <p className="rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">{editable.reason}</p>
      )}
      <fieldset disabled={!!locked} className="space-y-5">
        <Field label="タイトル（必須）" hint="漢字で入力できます。子どもの学年に合わせて自動表示します。本名や学校名は書かないでください" error={fieldErrors.title}>
          {(id, d) => (
            <input id={id} aria-describedby={d} className={inputClass("parent", !!fieldErrors.title)} value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={30} placeholder="りふてぃんぐ 50かい" required />
          )}
        </Field>
        <Field label="説明" hint="200文字まで" error={fieldErrors.description}>
          {(id, d) => (
            <textarea id={id} aria-describedby={d} className={`${inputClass()} py-2`} rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={200} placeholder="ボールを じめんに おとさずに 50かい つづけよう" />
          )}
        </Field>

        {!isEdit && (
          <div className="space-y-2">
            <p className="text-sm font-bold">カテゴリ（必須）</p>
            <div className="grid grid-cols-3 gap-2">
              {masters?.categories.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={v.categoryCode === c.code}
                  onClick={() => set("categoryCode", c.code)}
                  className={`min-h-12 rounded-xl border px-2 text-sm font-bold ${v.categoryCode === c.code ? "border-parent-primary bg-parent-soft text-parent-primary-dark" : "border-line bg-white"}`}
                >
                  <span aria-hidden>{CATEGORY_EMOJI[c.code]}</span> {c.label}
                </button>
              ))}
            </div>
            {fieldErrors.categoryCode && <p className="text-sm font-bold text-danger">{fieldErrors.categoryCode}</p>}
          </div>
        )}

        {!isEdit && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="目標値" hint="1〜9999" error={fieldErrors.targetValue}>
              {(id, d) => (
                <input id={id} aria-describedby={d} className={inputClass()} inputMode="numeric" value={v.targetValue} onChange={(e) => set("targetValue", e.target.value.replace(/[^0-9]/g, ""))} placeholder="50" />
              )}
            </Field>
            <Field label="単位" error={fieldErrors.targetUnit}>
              {(id, d) => (
                <select id={id} aria-describedby={d} className={inputClass()} value={v.targetUnit} onChange={(e) => set("targetUnit", e.target.value as TargetUnit | "")}>
                  <option value="">なし</option>
                  {TARGET_UNITS.map((u) => (
                    <option key={u} value={u}>{TARGET_UNIT_LABEL[u]}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-bold">確認方法（必須）</p>
          <div className="grid grid-cols-3 gap-2">
            {VERIFY_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={v.verifyMethod === m}
                disabled={isEdit && editable && !editable.verifyMethod}
                onClick={() => set("verifyMethod", m)}
                className={`min-h-12 rounded-xl border px-2 text-sm font-bold disabled:opacity-50 ${v.verifyMethod === m ? "border-parent-primary bg-parent-soft text-parent-primary-dark" : "border-line bg-white"}`}
              >
                {VERIFY_METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <Field label="期限日" hint="空欄なら期限なし" error={fieldErrors.dueDate}>
          {(id, d) => (
            <input id={id} aria-describedby={d} type="date" className={inputClass()} min={todayJst()} value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          )}
        </Field>

        {!isEdit && (
          <div className="space-y-2">
            <p className="text-sm font-bold">割り当てる子ども（必須）</p>
            {childOptions && childOptions.length === 0 && <p className="text-sm text-muted">先にお子さまのアカウントを作成してください。</p>}
            <div className="flex flex-wrap gap-2">
              {childOptions?.map((c) => (
                <label key={c.id} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 ${v.childIds.includes(c.id) ? "border-parent-primary bg-parent-soft" : "border-line bg-white"}`}>
                  <input type="checkbox" className="h-5 w-5" checked={v.childIds.includes(c.id)} onChange={() => toggleChild(c.id)} />
                  {c.displayName}
                </label>
              ))}
            </div>
            {fieldErrors.childIds && <p className="text-sm font-bold text-danger">{fieldErrors.childIds}</p>}
          </div>
        )}
      </fieldset>

      <Card className="bg-kid-bg">
        <p className="mb-2 text-xs font-bold text-muted">子どもの画面での見え方</p>
        <Field label="プレビューする学年">
          {id => <select id={id} className={`${inputClass()} mb-3`} value={grade} onChange={e => setPreviewGrade(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>小学{g}年生</option>)}
          </select>}
        </Field>
        <MissionTextPreview title={v.title} description={v.description} grade={grade} />
        <p className="mt-2 text-lg">
          {v.targetValue && v.targetUnit ? `${kidsLabel("target", grade)}：${v.targetValue}${targetUnitForGrade(v.targetUnit, grade)}　` : ""}
          {v.dueDate ? `${kidsLabel("deadline", grade)}：${formatMonthDayForGrade(v.dueDate, grade)}まで` : ""}
        </p>
        <p className="mt-3 text-xs text-muted">前の学年までの漢字を表示し、未習の漢字を含む語はひらがなにします。原文は保存されます。ひらがな入力を漢字へ戻す変換は行いません。固有名詞などの読み間違いや、辞書にない漢字が残る場合があるため、読み方をご確認ください。</p>
      </Card>

      {!locked && (
        <Button type="submit" block disabled={busy}>
          {busy ? "保存中…" : isEdit ? "保存する" : "ミッションを作る"}
        </Button>
      )}
    </form>
  );
}

/** フォームの値を API のリクエストに変換する */
export function toCreateBody(v: MissionFormValues) {
  return {
    title: v.title,
    description: v.description || null,
    categoryCode: v.categoryCode,
    targetValue: v.targetValue ? Number(v.targetValue) : null,
    targetUnit: v.targetUnit || null,
    verifyMethod: v.verifyMethod,
    dueDate: v.dueDate || null,
    childIds: v.childIds,
  };
}
