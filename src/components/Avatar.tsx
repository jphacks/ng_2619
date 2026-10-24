// アバター描画（T-703）。装備中のパーツを重ね順（lib/constants.ts の AVATAR_SLOTS）で重ねる。
import type { AvatarLayer } from "@/lib/types";

const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL ?? "";

export const assetUrl = (imagePath: string) => `${ASSETS_BASE}${imagePath}`;

export function Avatar({ layers, size = 160, label }: { layers: AvatarLayer[]; size?: number; label?: string }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-3xl bg-kid-soft"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? "アバター"}
    >
      {layers
        .filter((l) => !l.isNone)
        .map((l) => (
          <img key={l.slot} src={assetUrl(l.imagePath)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        ))}
    </div>
  );
}
