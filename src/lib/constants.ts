// 画面とサーバで共通に使う区分値・上限値（基本設計書 4.3 / 要件定義書 4.1）

export const ROLES = ["PARENT", "CHILD"] as const;
export type Role = (typeof ROLES)[number];

export const CHALLENGE_STATUSES = ["OPEN", "PENDING", "REJECTED", "APPROVED", "EXPIRED", "ARCHIVED"] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const VERIFY_METHODS = ["VIDEO", "VISUAL", "EITHER"] as const;
export type VerifyMethod = (typeof VERIFY_METHODS)[number];

export const SUBMISSION_METHODS = ["VIDEO", "VISUAL"] as const;
export type SubmissionMethod = (typeof SUBMISSION_METHODS)[number];

export const TARGET_UNITS = ["TIMES", "SECONDS", "MINUTES", "METERS"] as const;
export type TargetUnit = (typeof TARGET_UNITS)[number];

/** 重ねる順番（背面→前面）。基本設計書 4.3 avatar_items【要確認 BQ-12】 */
export const AVATAR_SLOTS = ["BG", "BOTTOM", "TOP", "FACE", "HAIR", "HAT", "ITEM"] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];

export const MAX_CHILDREN_PER_FAMILY = 5;
export const MAX_LEVEL = 50;

export const VIDEO_MAX_BYTES = 104_857_600;
export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

export const TERMS_VERSION = "2026-10-24";

// ---- 表示用ラベル ----

export const VERIFY_METHOD_LABEL: Record<VerifyMethod, string> = {
  VIDEO: "動画で確認",
  VISUAL: "目視で確認",
  EITHER: "どちらでも可",
};

export const TARGET_UNIT_LABEL: Record<TargetUnit, string> = {
  TIMES: "回",
  SECONDS: "秒",
  MINUTES: "分",
  METERS: "m",
};

export const TARGET_UNIT_KIDS_LABEL: Record<TargetUnit, string> = {
  TIMES: "かい",
  SECONDS: "びょう",
  MINUTES: "ふん",
  METERS: "メートル",
};

export const CHALLENGE_STATUS_LABEL: Record<ChallengeStatus, string> = {
  OPEN: "挑戦中",
  PENDING: "承認待ち",
  REJECTED: "差し戻し",
  APPROVED: "達成",
  EXPIRED: "期限切れ",
  ARCHIVED: "取り下げ",
};

export const CHALLENGE_STATUS_KIDS_LABEL: Partial<Record<ChallengeStatus, string>> = {
  OPEN: "ちょうせんちゅう",
  PENDING: "おうちのひとが かくにんちゅう",
  REJECTED: "もういちど ちょうせんしよう",
  APPROVED: "たっせい！",
};

export const AVATAR_SLOT_KIDS_LABEL: Record<AvatarSlot, string> = {
  BG: "はいけい",
  BOTTOM: "ふく（した）",
  TOP: "ふく（うえ）",
  FACE: "かお",
  HAIR: "かみがた",
  HAT: "ぼうし",
  ITEM: "もちもの",
};

/** C-06 のタブの並び（重ね順とは別） */
export const AVATAR_SLOT_TAB_ORDER: AvatarSlot[] = ["FACE", "HAIR", "TOP", "BOTTOM", "HAT", "ITEM", "BG"];
