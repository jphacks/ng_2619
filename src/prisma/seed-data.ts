// マスタの初期データ（基本設計書 4.3 / 要件定義書 4.1.5・4.1.6）
// 画像生成スクリプト（scripts/generate-avatar-placeholders.mjs）とシード投入の両方から使う。

export const LEVEL_TABLE_1_TO_10 = [0, 1, 3, 5, 8, 11, 15, 19, 24, 30];

/** Lv.1〜50 の必要累計達成数。Lv.11以降は前のレベル＋6（Lv.50 は 270） */
export function buildLevels(): { level: number; requiredCount: number }[] {
  const rows = LEVEL_TABLE_1_TO_10.map((requiredCount, i) => ({ level: i + 1, requiredCount }));
  for (let level = 11; level <= 50; level++) rows.push({ level, requiredCount: rows[rows.length - 1]!.requiredCount + 6 });
  return rows;
}

export const CATEGORIES = [
  { code: "BALL", label: "ボール", sortOrder: 1 },
  { code: "BAR", label: "鉄棒", sortOrder: 2 },
  { code: "ROPE", label: "なわとび", sortOrder: 3 },
  { code: "RUN", label: "走る", sortOrder: 4 },
  { code: "PLAYGROUND", label: "遊具", sortOrder: 5 },
  { code: "OTHER", label: "その他", sortOrder: 6 },
];

export const STAMPS = [
  { code: "GANBATTA", label: "がんばった！", sortOrder: 1 },
  { code: "TANOSHIKATTA", label: "たのしかった", sortOrder: 2 },
  { code: "MUZUKASHIKATTA", label: "むずかしかった", sortOrder: 3 },
  { code: "MATAYARITAI", label: "またやりたい", sortOrder: 4 },
];

export const COMMENT_TEMPLATES = ["すごいね！", "よくがんばったね", "かっこよかったよ", "見てたよ！", "つぎもがんばろう"];

export const SAFETY_MESSAGES = [
  "くるまに きをつけよう",
  "おうちのひとに いってから でかけよう",
  "くらくなるまえに かえろう",
  "みずを のもう",
  "こうえんの ルールを まもろう",
];

export type AvatarSeed = {
  id: string;
  slot: "BG" | "BOTTOM" | "TOP" | "FACE" | "HAIR" | "HAT" | "ITEM";
  name: string;
  unlockLevel: number;
  isNone?: boolean;
  color: string;
  variant?: string;
};

// 仮素材（T-701 で本番素材に差し替える）。各スロットに初期パーツがあり、Lv.2〜10 で毎回1つ以上解放される（RK-09）
export const AVATAR_ITEMS: AvatarSeed[] = [
  { id: "bg_park", slot: "BG", name: "こうえん", unlockLevel: 1, color: "#bbf7d0" },
  { id: "bg_school", slot: "BG", name: "こうてい", unlockLevel: 1, color: "#fde68a" },
  { id: "bg_beach", slot: "BG", name: "うみ", unlockLevel: 4, color: "#bae6fd" },
  { id: "bg_mountain", slot: "BG", name: "やま", unlockLevel: 7, color: "#d9f99d" },
  { id: "bg_stadium", slot: "BG", name: "スタジアム", unlockLevel: 10, color: "#c7d2fe" },

  { id: "bottom_shorts_blue", slot: "BOTTOM", name: "あおい はんズボン", unlockLevel: 1, color: "#1d4ed8", variant: "shorts" },
  { id: "bottom_shorts_red", slot: "BOTTOM", name: "あかい はんズボン", unlockLevel: 1, color: "#b91c1c", variant: "shorts" },
  { id: "bottom_pants_green", slot: "BOTTOM", name: "みどりの ズボン", unlockLevel: 1, color: "#15803d", variant: "pants" },
  { id: "bottom_jersey", slot: "BOTTOM", name: "ジャージ", unlockLevel: 5, color: "#312e81", variant: "pants" },
  { id: "bottom_skirt_pink", slot: "BOTTOM", name: "ピンクの スカート", unlockLevel: 8, color: "#db2777", variant: "skirt" },

  { id: "top_tshirt_red", slot: "TOP", name: "あかい Tシャツ", unlockLevel: 1, color: "#dc2626" },
  { id: "top_tshirt_blue", slot: "TOP", name: "あおい Tシャツ", unlockLevel: 1, color: "#2563eb" },
  { id: "top_tshirt_yellow", slot: "TOP", name: "きいろい Tシャツ", unlockLevel: 1, color: "#eab308" },
  { id: "top_soccer", slot: "TOP", name: "サッカーの ユニフォーム", unlockLevel: 2, color: "#16a34a", variant: "stripe" },
  { id: "top_jersey", slot: "TOP", name: "ジャージの うわぎ", unlockLevel: 6, color: "#312e81", variant: "stripe" },
  { id: "top_hero", slot: "TOP", name: "ヒーローの ふく", unlockLevel: 9, color: "#7c3aed", variant: "star" },

  { id: "face_smile_light", slot: "FACE", name: "にっこり", unlockLevel: 1, color: "#fde2c4", variant: "smile" },
  { id: "face_smile_tan", slot: "FACE", name: "にっこり（こんがり）", unlockLevel: 1, color: "#d6a77a", variant: "smile" },
  { id: "face_grin_light", slot: "FACE", name: "わくわく", unlockLevel: 1, color: "#fde2c4", variant: "grin" },
  { id: "face_grin_tan", slot: "FACE", name: "わくわく（こんがり）", unlockLevel: 1, color: "#d6a77a", variant: "grin" },
  { id: "face_wink", slot: "FACE", name: "ウインク", unlockLevel: 3, color: "#fde2c4", variant: "wink" },
  { id: "face_star", slot: "FACE", name: "キラキラ", unlockLevel: 8, color: "#fde2c4", variant: "star" },

  { id: "hair_short_black", slot: "HAIR", name: "みじかい くろかみ", unlockLevel: 1, color: "#1f2937", variant: "short" },
  { id: "hair_long_black", slot: "HAIR", name: "ながい くろかみ", unlockLevel: 1, color: "#1f2937", variant: "long" },
  { id: "hair_short_brown", slot: "HAIR", name: "みじかい ちゃいろ", unlockLevel: 1, color: "#78350f", variant: "short" },
  { id: "hair_bob_brown", slot: "HAIR", name: "ボブ（ちゃいろ）", unlockLevel: 1, color: "#78350f", variant: "long" },
  { id: "hair_spiky", slot: "HAIR", name: "ツンツン", unlockLevel: 3, color: "#1f2937", variant: "spiky" },
  { id: "hair_ponytail", slot: "HAIR", name: "ポニーテール", unlockLevel: 5, color: "#1f2937", variant: "pony" },
  { id: "hair_color_blue", slot: "HAIR", name: "あおい かみ", unlockLevel: 9, color: "#2563eb", variant: "spiky" },

  { id: "hat_none", slot: "HAT", name: "なし", unlockLevel: 1, isNone: true, color: "none" },
  { id: "hat_cap_red", slot: "HAT", name: "あかい ぼうし", unlockLevel: 2, color: "#dc2626", variant: "cap" },
  { id: "hat_straw", slot: "HAT", name: "むぎわらぼうし", unlockLevel: 4, color: "#d97706", variant: "straw" },
  { id: "hat_helmet", slot: "HAT", name: "ヘルメット", unlockLevel: 7, color: "#f8fafc", variant: "helmet" },

  { id: "item_none", slot: "ITEM", name: "なし", unlockLevel: 1, isNone: true, color: "none" },
  { id: "item_soccer_ball", slot: "ITEM", name: "サッカーボール", unlockLevel: 2, color: "#ffffff", variant: "ball" },
  { id: "item_jump_rope", slot: "ITEM", name: "なわとび", unlockLevel: 3, color: "#f97316", variant: "rope" },
  { id: "item_baseball", slot: "ITEM", name: "やきゅうの バット", unlockLevel: 6, color: "#a16207", variant: "bat" },
  { id: "item_trophy", slot: "ITEM", name: "トロフィー", unlockLevel: 10, color: "#eab308", variant: "trophy" },
];

export const avatarImagePath = (id: string) => `/avatars/${id}.svg`;
export const categoryIconPath = (code: string) => `/icons/category-${code.toLowerCase()}.svg`;
export const stampIconPath = (code: string) => `/icons/stamp-${code.toLowerCase()}.svg`;
