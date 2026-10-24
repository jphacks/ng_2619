// 環境変数の読み込み（.env.example 参照）

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`環境変数 ${name} が設定されていません`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";

export const env = {
  isProd,
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  /** IPアドレスのHMAC用（NF-S-05）。本番では Secret Manager から渡す */
  get ipHashSecret() {
    return required("IP_HASH_SECRET", isProd ? undefined : "dev-ip-hash-secret");
  },
  storageDriver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "gcs",
  /** local ドライバの署名用 */
  get storageLocalSecret() {
    return required("STORAGE_LOCAL_SECRET", isProd ? undefined : "dev-storage-secret");
  },
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? ".storage",
  gcsRawBucket: process.env.GCS_RAW_BUCKET ?? "",
  gcsVideoBucket: process.env.GCS_VIDEO_BUCKET ?? "",
  ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH ?? "ffprobe",
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  mailFrom: process.env.MAIL_FROM ?? "no-reply@example.com",
  /** 問い合わせの転送先【要確認 BQ-09】 */
  inquiryToEmail: process.env.INQUIRY_TO_EMAIL ?? "",
};
