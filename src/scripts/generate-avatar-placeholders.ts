// 仮のアバター素材・アイコンを public/ に生成する（T-701 の本番素材ができるまでの代用）
// 使い方: npm run avatars:generate
// 512×512 のキャンバスに、スロットごとの絵を重ねる前提で描く（重ね順は lib/constants.ts の AVATAR_SLOTS）

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AVATAR_ITEMS, CATEGORIES, STAMPS, type AvatarSeed } from "../prisma/seed-data";

const SKIN = "#f1c9a5";
const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${body}</svg>\n`;

function bg(item: AvatarSeed): string {
  return `<rect width="512" height="512" fill="${item.color}"/>
<circle cx="430" cy="80" r="40" fill="#fde047" opacity="0.9"/>
<rect y="400" width="512" height="112" fill="#000" opacity="0.08"/>`;
}

function bottom(item: AvatarSeed): string {
  const legs = `<rect x="214" y="370" width="34" height="90" rx="10" fill="${SKIN}"/>
<rect x="264" y="370" width="34" height="90" rx="10" fill="${SKIN}"/>
<rect x="204" y="452" width="50" height="22" rx="10" fill="#334155"/>
<rect x="258" y="452" width="50" height="22" rx="10" fill="#334155"/>`;
  if (item.variant === "pants") {
    return `${legs}<rect x="206" y="328" width="100" height="60" rx="12" fill="${item.color}"/>
<rect x="210" y="360" width="42" height="96" rx="10" fill="${item.color}"/>
<rect x="260" y="360" width="42" height="96" rx="10" fill="${item.color}"/>`;
  }
  if (item.variant === "skirt") {
    return `${legs}<path d="M210 328 H302 L326 410 H186 Z" fill="${item.color}"/>`;
  }
  return `${legs}<rect x="204" y="328" width="104" height="66" rx="12" fill="${item.color}"/>`;
}

function top(item: AvatarSeed): string {
  let deco = "";
  if (item.variant === "stripe") {
    deco = `<rect x="190" y="262" width="132" height="12" fill="#fff" opacity="0.8"/><rect x="190" y="294" width="132" height="12" fill="#fff" opacity="0.8"/>`;
  } else if (item.variant === "star") {
    deco = `<polygon points="256,246 266,272 294,272 272,288 280,314 256,298 232,314 240,288 218,272 246,272" fill="#fde047"/>`;
  }
  return `<rect x="150" y="226" width="54" height="40" rx="14" fill="${item.color}" transform="rotate(-20 177 246)"/>
<rect x="308" y="226" width="54" height="40" rx="14" fill="${item.color}" transform="rotate(20 335 246)"/>
<rect x="190" y="220" width="132" height="122" rx="26" fill="${item.color}"/>${deco}`;
}

function face(item: AvatarSeed): string {
  const eyes =
    item.variant === "wink"
      ? `<circle cx="230" cy="158" r="8" fill="#1f2937"/><path d="M272 158 q10 -10 20 0" stroke="#1f2937" stroke-width="5" fill="none"/>`
      : item.variant === "star"
        ? `<polygon points="230,146 234,156 245,156 236,162 240,172 230,166 220,172 224,162 215,156 226,156" fill="#f59e0b"/><polygon points="282,146 286,156 297,156 288,162 292,172 282,166 272,172 276,162 267,156 278,156" fill="#f59e0b"/>`
        : `<circle cx="230" cy="158" r="8" fill="#1f2937"/><circle cx="282" cy="158" r="8" fill="#1f2937"/>`;
  const mouth =
    item.variant === "grin"
      ? `<path d="M226 190 q30 30 60 0 z" fill="#b91c1c"/>`
      : `<path d="M232 192 q24 18 48 0" stroke="#b91c1c" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  return `<rect x="238" y="200" width="36" height="30" fill="${item.color}"/>
<circle cx="256" cy="160" r="66" fill="${item.color}"/>
<circle cx="214" cy="182" r="10" fill="#fb7185" opacity="0.45"/><circle cx="298" cy="182" r="10" fill="#fb7185" opacity="0.45"/>
${eyes}${mouth}`;
}

function hair(item: AvatarSeed): string {
  const c = item.color;
  const cap = `<path d="M190 150 Q194 86 256 84 Q318 86 322 150 Q300 118 256 116 Q212 118 190 150 Z" fill="${c}"/>`;
  switch (item.variant) {
    case "long":
      return `${cap}<rect x="184" y="130" width="22" height="100" rx="10" fill="${c}"/><rect x="306" y="130" width="22" height="100" rx="10" fill="${c}"/>`;
    case "spiky":
      return `${cap}<polygon points="200,112 214,70 232,104" fill="${c}"/><polygon points="236,96 256,56 276,96" fill="${c}"/><polygon points="280,104 298,70 312,112" fill="${c}"/>`;
    case "pony":
      return `${cap}<ellipse cx="336" cy="150" rx="22" ry="44" fill="${c}"/><circle cx="318" cy="118" r="10" fill="#f472b6"/>`;
    default:
      return cap;
  }
}

function hat(item: AvatarSeed): string {
  if (item.isNone) return "";
  if (item.variant === "straw") {
    return `<ellipse cx="256" cy="112" rx="110" ry="22" fill="${item.color}"/><path d="M200 112 Q204 60 256 58 Q308 60 312 112 Z" fill="${item.color}"/><rect x="200" y="96" width="112" height="12" fill="#dc2626"/>`;
  }
  if (item.variant === "helmet") {
    return `<path d="M184 140 Q186 74 256 70 Q326 74 328 140 Z" fill="${item.color}" stroke="#94a3b8" stroke-width="4"/><rect x="246" y="72" width="20" height="66" fill="#38bdf8"/>`;
  }
  return `<path d="M192 122 Q196 72 256 70 Q316 72 320 122 Z" fill="${item.color}"/><rect x="250" y="112" width="104" height="16" rx="8" fill="${item.color}"/>`;
}

function itemLayer(item: AvatarSeed): string {
  if (item.isNone) return "";
  switch (item.variant) {
    case "ball":
      return `<circle cx="372" cy="430" r="34" fill="#fff" stroke="#1f2937" stroke-width="4"/><polygon points="372,414 386,424 381,440 363,440 358,424" fill="#1f2937"/>`;
    case "rope":
      return `<path d="M150 300 Q256 520 362 300" stroke="${item.color}" stroke-width="8" fill="none"/><rect x="138" y="280" width="20" height="36" rx="6" fill="#1f2937"/><rect x="354" y="280" width="20" height="36" rx="6" fill="#1f2937"/>`;
    case "bat":
      return `<rect x="346" y="170" width="22" height="170" rx="10" fill="${item.color}" transform="rotate(25 357 255)"/>`;
    case "trophy":
      return `<path d="M346 360 h56 v20 q0 34 -28 40 q-28 -6 -28 -40 z" fill="${item.color}"/><rect x="366" y="418" width="16" height="22" fill="${item.color}"/><rect x="350" y="438" width="48" height="12" rx="4" fill="#a16207"/>`;
    default:
      return "";
  }
}

const render: Record<AvatarSeed["slot"], (i: AvatarSeed) => string> = {
  BG: bg,
  BOTTOM: bottom,
  TOP: top,
  FACE: face,
  HAIR: hair,
  HAT: hat,
  ITEM: itemLayer,
};

const publicDir = path.resolve(__dirname, "..", "public");
mkdirSync(path.join(publicDir, "avatars"), { recursive: true });
mkdirSync(path.join(publicDir, "icons"), { recursive: true });

for (const item of AVATAR_ITEMS) {
  writeFileSync(path.join(publicDir, "avatars", `${item.id}.svg`), wrap(render[item.slot](item)));
}

const EMOJI: Record<string, string> = {
  BALL: "⚽",
  BAR: "🤸",
  ROPE: "➰",
  RUN: "🏃",
  PLAYGROUND: "🛝",
  OTHER: "⭐",
  GANBATTA: "💪",
  TANOSHIKATTA: "😄",
  MUZUKASHIKATTA: "😤",
  MATAYARITAI: "🔁",
};
const icon = (emoji: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><text x="32" y="44" font-size="40" text-anchor="middle">${emoji}</text></svg>\n`;
for (const c of CATEGORIES) writeFileSync(path.join(publicDir, "icons", `category-${c.code.toLowerCase()}.svg`), icon(EMOJI[c.code]!));
for (const s of STAMPS) writeFileSync(path.join(publicDir, "icons", `stamp-${s.code.toLowerCase()}.svg`), icon(EMOJI[s.code]!));

console.log(`generated ${AVATAR_ITEMS.length} avatar parts and ${CATEGORIES.length + STAMPS.length} icons`);
