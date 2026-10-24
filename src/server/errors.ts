// APIのエラー（基本設計書 5.2 エラーレスポンス）

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "AUTH_INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "REAUTH_REQUIRED"
  | "NOT_FOUND"
  | "CONFLICT_STATE"
  | "LOGIN_ID_TAKEN"
  | "EMAIL_TAKEN"
  | "CHILD_LIMIT_EXCEEDED"
  | "VIDEO_NOT_UPLOADED"
  | "CHALLENGE_EXPIRED"
  | "AUTH_LOCKED"
  | "AUTH_RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly extra: { reason?: string; fields?: Record<string, string> } = {},
  ) {
    super(message);
  }
}

export const errors = {
  validation: (message = "入力内容を確認してください", fields?: Record<string, string>) =>
    new AppError(400, "VALIDATION_ERROR", message, { fields }),
  authRequired: () => new AppError(401, "AUTH_REQUIRED", "ログインしてください"),
  invalidCredentials: () => new AppError(401, "AUTH_INVALID_CREDENTIALS", "ユーザIDまたはパスワードが違います"),
  forbidden: (message = "この操作はできません") => new AppError(403, "FORBIDDEN", message),
  reauthRequired: () => new AppError(403, "REAUTH_REQUIRED", "パスワードを入力してください"),
  notFound: (message = "見つかりません") => new AppError(404, "NOT_FOUND", message),
  conflict: (reason?: string, message = "状態が変わっています。画面を読み込み直してください") =>
    new AppError(409, "CONFLICT_STATE", message, { reason }),
  loginIdTaken: () =>
    new AppError(409, "LOGIN_ID_TAKEN", "このユーザIDは使われています", { fields: { loginId: "このユーザIDは使われています" } }),
  emailTaken: () =>
    new AppError(409, "EMAIL_TAKEN", "このメールアドレスは使われています", {
      fields: { email: "このメールアドレスは使われています" },
    }),
  childLimit: (max: number) => new AppError(422, "CHILD_LIMIT_EXCEEDED", `子どもアカウントは${max}人までです`),
  videoNotUploaded: () => new AppError(422, "VIDEO_NOT_UPLOADED", "動画が届いていません。もう一度送ってください"),
  challengeExpired: () => new AppError(422, "CHALLENGE_EXPIRED", "期限を過ぎています"),
  locked: () => new AppError(423, "AUTH_LOCKED", "しばらく ログインできません。15ふん たってから もういちど ためしてね"),
  rateLimited: () => new AppError(429, "AUTH_RATE_LIMITED", "ためした回数が多すぎます。少し待ってからもう一度お試しください"),
};
