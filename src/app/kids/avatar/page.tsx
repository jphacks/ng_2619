"use client";

// C-06 アバター着せ替え（F-AVT-01〜03）。?initial=1 は初回ログイン時の作成
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AVATAR_SLOT_KIDS_LABEL, AVATAR_SLOT_TAB_ORDER, AVATAR_SLOTS, type AvatarSlot } from "@/lib/constants";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { AvatarLayer, AvatarState } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Button, ErrorBanner, Loading } from "@/components/ui";

function AvatarEditor() {
  const router = useRouter();
  const initial = useSearchParams().get("initial") === "1";
  const { data, error, loading, setData } = useApi<AvatarState>("/kids/avatar");
  const [equips, setEquips] = useState<Record<AvatarSlot, string> | null>(null);
  const [tab, setTab] = useState<AvatarSlot>(AVATAR_SLOT_TAB_ORDER[0]!);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !equips) setEquips(data.equips);
  }, [data, equips]);

  /** 装備（＋1スロットだけ差し替えた場合）のレイヤー。パーツの一覧では、そのパーツを着た姿を見せる */
  const layersFor = useCallback(
    (override?: { slot: AvatarSlot; itemId: string }): AvatarLayer[] => {
      if (!data || !equips) return [];
      const byId = new Map(data.items.map((i) => [i.id, i]));
      return AVATAR_SLOTS.flatMap((slot) => {
        const item = byId.get(override?.slot === slot ? override.itemId : equips[slot]);
        return item ? [{ slot, itemId: item.id, imagePath: item.imagePath, isNone: item.isNone }] : [];
      });
    },
    [data, equips],
  );
  const layers = useMemo(() => layersFor(), [layersFor]);

  async function save() {
    if (!equips) return;
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    try {
      setData(await api<AvatarState>("/kids/avatar", { method: "PUT", body: { equips } }));
      if (initial) {
        router.replace("/kids");
        return;
      }
      setMessage("きせかえたよ！");
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data || !equips) return <Loading label="よみこみちゅう…" />;
  if (error) return <ErrorBanner message={error.message} />;
  const items = data.items.filter((i) => i.slot === tab);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{initial ? "じぶんの アバターを つくろう！" : "アバター"}</h1>
      <div className="flex justify-center">
        <Avatar layers={layers} size={220} label="じぶんの アバター" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="パーツの しゅるい">
        {AVATAR_SLOT_TAB_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`min-h-12 shrink-0 rounded-full px-4 text-lg font-bold ${tab === s ? "bg-kid-primary text-white" : "bg-white text-kid-ink ring-2 ring-kid-soft"}`}
          >
            {AVATAR_SLOT_KIDS_LABEL[s]}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-3 gap-3" role="tabpanel">
        {items.map((i) => {
          const selected = equips[tab] === i.id;
          return (
            <li key={i.id}>
              <button
                type="button"
                disabled={!i.unlocked}
                aria-pressed={selected}
                onClick={() => setEquips((e) => (e ? { ...e, [tab]: i.id } : e))}
                className={`relative flex w-full flex-col items-center rounded-2xl border-4 bg-white p-1 ${selected ? "border-kid-primary" : "border-transparent"} disabled:opacity-60`}
              >
                <Avatar layers={layersFor({ slot: tab, itemId: i.id })} size={96} label={i.name} />
                <span className="mt-1 text-sm">{i.name}</span>
                {!i.unlocked && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/70 text-base font-bold">
                    <span aria-hidden className="text-2xl">🔒</span>
                    Lv.{i.unlockLevel}で かいほう
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <ErrorBanner message={saveError} />
      {message && <p role="status" className="rounded-2xl bg-kid-soft p-3 text-center text-xl font-bold">{message}</p>}
      <Button tone="kid" block disabled={saving} onClick={save}>
        {saving ? "ほぞんちゅう…" : "けってい"}
      </Button>
    </div>
  );
}

export default function AvatarPage() {
  return (
    <Suspense fallback={<Loading label="よみこみちゅう…" />}>
      <AvatarEditor />
    </Suspense>
  );
}
