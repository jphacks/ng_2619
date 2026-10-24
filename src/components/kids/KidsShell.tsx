"use client";

// 子ども画面の共通レイアウト（下部タブ：ホーム／きろく／アバター）。大きな文字・ボタン（NF-U-03〜05）
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const TABS = [
  { href: "/kids", label: "ホーム", icon: "🏠", match: (p: string) => p === "/kids" || p.startsWith("/kids/challenges") },
  { href: "/kids/records", label: "きろく", icon: "📒", match: (p: string) => p.startsWith("/kids/records") },
  { href: "/kids/avatar", label: "アバター", icon: "👕", match: (p: string) => p.startsWith("/kids/avatar") },
];

export function KidsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-kid-bg pb-28 text-lg text-kid-ink">
      <header className="mx-auto flex max-w-[640px] items-center justify-between px-4 pt-4">
        <span className="text-xl font-bold text-kid-primary">そとあそびミッション</span>
        <button type="button" onClick={logout} className="min-h-12 rounded-xl px-3 text-base font-bold text-muted hover:bg-black/5">
          おわる
        </button>
      </header>
      <main className="mx-auto max-w-[640px] px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-kid-sun bg-white pb-[env(safe-area-inset-bottom)]" aria-label="メニュー">
        <ul className="mx-auto grid max-w-[640px] grid-cols-3">
          {TABS.map((t) => {
            const active = t.match(pathname);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center text-base font-bold ${active ? "text-kid-primary" : "text-muted"}`}
                >
                  <span className="text-2xl" aria-hidden>{t.icon}</span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
