"use client";

// 保護者画面の共通レイアウト（下部タブ：ホーム／ミッション／承認／設定）
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReauthProvider } from "./ReauthProvider";

const TABS = [
  { href: "/parent", label: "ホーム", icon: "🏠", match: (p: string) => p === "/parent" || p.startsWith("/parent/children") },
  { href: "/parent/missions", label: "ミッション", icon: "🚩", match: (p: string) => p.startsWith("/parent/missions") },
  { href: "/parent/approvals", label: "承認", icon: "✅", match: (p: string) => p.startsWith("/parent/approvals") },
  { href: "/parent/settings", label: "設定", icon: "⚙️", match: (p: string) => p.startsWith("/parent/settings") || p.startsWith("/parent/inquiry") },
];

export function ParentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ReauthProvider>
      <div className="min-h-dvh bg-parent-bg pb-24">
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[640px] items-center px-4">
            <Link href="/parent" className="font-bold text-parent-primary">
              ちるちゃれ <span className="text-xs text-muted">保護者</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[640px] px-4 py-5">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]" aria-label="メニュー">
          <ul className="mx-auto grid max-w-[640px] grid-cols-4">
            {TABS.map((t) => {
              const active = t.match(pathname);
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center text-xs font-bold ${active ? "text-parent-primary" : "text-muted"}`}
                  >
                    <span className="text-xl" aria-hidden>{t.icon}</span>
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </ReauthProvider>
  );
}
