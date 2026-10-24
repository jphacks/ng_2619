import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "そとあそびミッション（仮称）",
  description: "子どもが外で遊ぶきっかけをつくる、親子のミッションアプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

// メンテナンス表示（NF-A-02）を実行時の環境変数で切り替えるため、動的に描画する
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const maintenance = process.env.MAINTENANCE_MODE === "on";
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        {maintenance ? (
          <main className="mx-auto max-w-[640px] px-4 py-16 text-center">
            <h1 className="text-2xl font-bold">ただいまメンテナンス中です</h1>
            <p className="mt-4 text-muted">しばらくしてから、もう一度アクセスしてください。</p>
            <p className="mt-2 text-lg">いまは つかえないよ。あとで また きてね。</p>
          </main>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
