import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// 基本設計書 6.3 NF-S-01 / NF-S-06 のセキュリティヘッダ
const assetsOrigin = process.env.NEXT_PUBLIC_ASSETS_BASE_URL?.startsWith("http")
  ? new URL(process.env.NEXT_PUBLIC_ASSETS_BASE_URL).origin
  : "";
const storageOrigin = process.env.STORAGE_DRIVER === "gcs" ? "https://storage.googleapis.com" : "";

const csp = [
  "default-src 'self'",
  // Next.js のハイドレーション用インラインスクリプトのため 'unsafe-inline' を許可（nonce化は Phase 2）
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${assetsOrigin}`.trim(),
  `media-src 'self' blob: ${storageOrigin}`.trim(),
  `connect-src 'self' ${storageOrigin}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  // Docker イメージ用（Dockerfile で NEXT_OUTPUT=standalone を設定）。ローカルの npm start では使わない
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["@node-rs/argon2", "@google-cloud/storage"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
