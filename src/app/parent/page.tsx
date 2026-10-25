"use client";

// P-01 保護者ホーム（F-APV-01, 06, F-AVT-04）
import Link from "next/link";
import { useApi } from "@/lib/hooks";
import type { ParentDashboard } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Card, EmptyState, ErrorBanner, LinkButton, Loading } from "@/components/ui";
import { GrowthDashboard } from "@/components/parent/GrowthDashboard";

export default function ParentHomePage() {
  const { data, error, loading } = useApi<ParentDashboard>("/parent/dashboard");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBanner message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <Link
        href="/parent/approvals"
        className={`flex items-center justify-between rounded-2xl p-4 font-bold ${data.pendingCount > 0 ? "bg-orange-100 text-orange-900" : "bg-white text-muted ring-1 ring-black/5"}`}
      >
        <span>承認待ちの申請</span>
        <span className={`rounded-full px-3 py-1 text-lg ${data.pendingCount > 0 ? "bg-kid-accent text-white" : "bg-slate-100"}`}>
          {data.pendingCount}件
        </span>
      </Link>

      <LinkButton href="/parent/missions/new" block>
        ＋ ミッションを作る
      </LinkButton>

      <GrowthDashboard />

      <section className="space-y-3">
        <h2 className="text-lg font-bold">お子さま</h2>
        {data.children.length === 0 ? (
          <EmptyState>
            <p>まずはお子さまを登録しましょう</p>
            <LinkButton href="/parent/children" className="mt-3">子どもアカウントを作る</LinkButton>
          </EmptyState>
        ) : (
          data.children.map((c) => (
            <Link key={c.id} href={`/parent/children/${c.id}`} className="block">
              <Card className="flex items-center gap-4 hover:ring-parent-primary">
                <Avatar layers={c.avatar} size={72} label={`${c.displayName}のアバター`} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">
                    {c.displayName} <span className="text-sm font-normal text-muted">{c.grade}年生</span>
                  </p>
                  <p className="font-bold text-kid-primary">Lv.{c.level}</p>
                  <p className="text-sm text-muted">
                    挑戦中 {c.activeCount}件 ・ 今週の達成 {c.weekApprovedCount}件 ・ 累計 {c.approvedCount}件
                  </p>
                </div>
              </Card>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
