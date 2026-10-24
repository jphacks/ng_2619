"use client";

// C-07 レベルアップ演出（F-LV-03）
import type { KidsHome } from "@/lib/types";
import { assetUrl } from "@/components/Avatar";
import { Button } from "@/components/ui";

export function LevelUpModal({
  levelUp,
  onClose,
  onDressUp,
}: {
  levelUp: NonNullable<KidsHome["levelUp"]>;
  onClose: () => void;
  onDressUp: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="レベルアップ" className="animate-pop w-full max-w-[480px] rounded-3xl bg-white p-6 text-center shadow-2xl">
        <p className="text-5xl" aria-hidden>🎉</p>
        <p className="mt-2 text-3xl font-bold text-kid-accent">レベルアップ！</p>
        <p className="mt-2 text-4xl font-bold text-kid-primary">Lv.{levelUp.to}</p>
        {levelUp.unlockedItems.length > 0 && (
          <div className="mt-5">
            <p className="text-lg font-bold">あたらしい パーツが つかえるよ</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-3">
              {levelUp.unlockedItems.map((i) => (
                <li key={i.id} className="w-24">
                  <img src={assetUrl(i.imagePath)} alt="" className="h-24 w-24 rounded-2xl bg-kid-soft" />
                  <p className="mt-1 text-sm">{i.name}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 grid gap-3">
          {levelUp.unlockedItems.length > 0 && (
            <Button tone="kid" block onClick={onDressUp}>きせかえる</Button>
          )}
          <Button tone="kid" variant="secondary" block onClick={onClose}>とじる</Button>
        </div>
      </div>
    </div>
  );
}
