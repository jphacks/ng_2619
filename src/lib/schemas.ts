// 入力チェック（画面とサーバで共通。基本設計書 5.2）
// 要件定義書 4.1.1「入力項目の制約」/ 4.1.2「ミッションの入力項目」

import { z } from "zod";
import {
  AVATAR_SLOTS,
  SUBMISSION_METHODS,
  TARGET_UNITS,
  VERIFY_METHODS,
  VIDEO_CONTENT_TYPES,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
} from "./constants";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が正しくありません");
const uuid = z.string().uuid("IDの形式が正しくありません");

export const loginIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,20}$/, "ユーザIDは半角英数字と _ で4〜20文字にしてください");

export const parentPasswordSchema = z
  .string()
  .min(8, "パスワードは8文字以上にしてください")
  .max(64, "パスワードは64文字以内にしてください")
  .regex(/[A-Za-z]/, "英字を1文字以上入れてください")
  .regex(/[0-9]/, "数字を1文字以上入れてください");

// 【要確認 要件定義書 Q-06】低学年向けに数字のみも可
export const childPasswordSchema = z
  .string()
  .min(6, "パスワードは6文字以上にしてください")
  .max(32, "パスワードは32文字以内にしてください");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "表示名を入力してください")
  .max(10, "表示名は10文字以内にしてください");

export const emailSchema = z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません").max(254);

export const gradeSchema = z.coerce.number().int().min(1).max(6);

// ---- 認証 ----

export const loginSchema = z.object({
  loginId: z.string().trim().toLowerCase().min(1, "ユーザIDを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export const signupSchema = z.object({
  loginId: loginIdSchema,
  password: parentPasswordSchema,
  displayName: displayNameSchema,
  email: emailSchema,
  agreeTerms: z.literal(true, { errorMap: () => ({ message: "利用規約とプライバシーポリシーへの同意が必要です" }) }),
});

export const reauthSchema = z.object({ password: z.string().min(1, "パスワードを入力してください") });

export const passwordResetRequestSchema = z.object({ email: emailSchema });
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(10).max(200),
  password: parentPasswordSchema,
});

export const meUpdateSchema = z
  .object({ displayName: displayNameSchema.optional(), email: emailSchema.optional() })
  .refine((v) => v.displayName !== undefined || v.email !== undefined, "変更する項目がありません");

export const mePasswordSchema = z.object({
  currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
  newPassword: parentPasswordSchema,
});

export const settingsUpdateSchema = z.object({ reauthRequired: z.boolean() });

// ---- 子どもアカウント ----

export const childCreateSchema = z.object({
  displayName: displayNameSchema,
  grade: gradeSchema,
  loginId: loginIdSchema,
  password: childPasswordSchema,
});

export const childUpdateSchema = z
  .object({ displayName: displayNameSchema.optional(), grade: gradeSchema.optional() })
  .refine((v) => v.displayName !== undefined || v.grade !== undefined, "変更する項目がありません");

export const childPasswordUpdateSchema = z.object({ password: childPasswordSchema });

// ---- ミッション ----

const missionFields = {
  title: z.string().trim().min(1, "タイトルを入力してください").max(30, "タイトルは30文字以内にしてください"),
  description: z
    .string()
    .trim()
    .max(200, "説明は200文字以内にしてください")
    .nullish()
    .transform((v) => (v ? v : null)),
  verifyMethod: z.enum(VERIFY_METHODS).default("EITHER"),
  dueDate: ymd.nullish().transform((v) => v ?? null),
};

export const missionCreateSchema = z
  .object({
    ...missionFields,
    categoryCode: z.string().min(1, "カテゴリを選んでください"),
    targetValue: z.coerce.number().int().min(1).max(9999).nullish().transform((v) => v ?? null),
    targetUnit: z.enum(TARGET_UNITS).nullish().transform((v) => v ?? null),
    childIds: z.array(uuid).min(1, "割り当てる子どもを1人以上選んでください").max(5),
  })
  .transform(v => ({ ...v, targetUnit: v.targetValue !== null ? v.targetUnit ?? ("TIMES" as const) : v.targetUnit }))
  .refine((v) => (v.targetValue === null) === (v.targetUnit === null), {
    message: "目標値と単位は両方入力するか、両方空にしてください",
    path: ["targetUnit"],
  });

export const missionUpdateSchema = z
  .object({
    title: missionFields.title.optional(),
    description: missionFields.description.optional(),
    verifyMethod: missionFields.verifyMethod.optional(),
    dueDate: missionFields.dueDate.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "変更する項目がありません");

// ---- 申請・承認 ----

export const reviewCommentSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(100, "コメントは100文字以内にしてください")
    .nullish()
    .transform((v) => (v ? v : null)),
});

export const rejectSchema = z.object({
  comment: z.string().trim().min(1, "差し戻す理由を入力してください").max(100, "コメントは100文字以内にしてください"),
});

export const videoUploadUrlSchema = z.object({
  contentType: z.enum(VIDEO_CONTENT_TYPES, { errorMap: () => ({ message: "この形式の動画は送れません" }) }),
  sizeBytes: z.coerce.number().int().min(1).max(VIDEO_MAX_BYTES, "動画が大きすぎます（100MBまで）"),
  // ブラウザが返す長さには誤差があるため、サーバでは0.5秒の余裕を持たせる（超えた分は変換時に打ち切る。BQ-08）
  durationSec: z.coerce.number().positive().max(VIDEO_MAX_SECONDS + 0.5, "動画が長すぎます（60秒まで）"),
});

export const submissionCreateSchema = z
  .object({
    method: z.enum(SUBMISSION_METHODS),
    videoId: uuid.optional(),
    stampCode: z.string().max(40).nullish().transform((v) => v ?? null),
  })
  .refine((v) => v.method !== "VIDEO" || !!v.videoId, { message: "動画がありません", path: ["videoId"] });

export const noticesAckSchema = z.object({ submissionIds: z.array(uuid).min(1).max(50) });

// ---- アバター ----

export const avatarUpdateSchema = z.object({
  equips: z.record(z.enum(AVATAR_SLOTS), z.string().min(1)),
});

// ---- 問い合わせ ----

export const inquirySchema = z.object({
  subject: z.string().trim().min(1, "件名を入力してください").max(50, "件名は50文字以内にしてください"),
  body: z.string().trim().min(1, "本文を入力してください").max(2000, "本文は2000文字以内にしてください"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type MissionCreateInput = z.infer<typeof missionCreateSchema>;
export type MissionUpdateInput = z.infer<typeof missionUpdateSchema>;
