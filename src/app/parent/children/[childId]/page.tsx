"use client";

// P-06 子ども詳細（F-APV-06, 08）
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMonthDay, yearMonthJst } from "@/lib/date";
import { useApi } from "@/lib/hooks";
import type { ChildSummary } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Button, Card, EmptyState, ErrorBanner, LinkButton, Loading } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { CompleteModal, type CompleteTarget } from "@/components/parent/CompleteModal";

export default function ChildDetailPage() {
  const { childId } = useParams<{ childId: string }>();
  const { data, error, loading, reload } = useApi<ChildSummary>(`/children/${childId}/summary`);
  const [target, setTarget] = useState<CompleteTarget | null>(null);

  const byMonth = useMemo(() => {
    const groups = new Map<string, ChildSummary["history"]>();
    for (const h of data?.history ?? []) {
      const key = yearMonthJst(h.approvedAt);
      groups.set(key, [...(groups.get(key) ?? []), h]);
    }
    return [...groups];
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBanner message={error?.message ?? "見つかりません"} />;

  return (
    <div className="space-y-5">
      <Link href="/parent" className="text-sm text-parent-primary underline">‹ ホーム</Link>
      <Card className="flex items-center gap-4">
        <Avatar layers={data.avatar} size={96} label={`${data.displayName}のアバター`} />
        <div>
          <p className="text-xl font-bold">
            {data.displayName} <span className="text-sm font-normal text-muted">{data.grade}年生</span>
          </p>
          <p className="text-lg font-bold text-kid-primary">Lv.{data.level}</p>
          <p className="text-sm text-muted">
            累計 {data.approvedCount}件{data.remainingToNext !== null ? ` ・ 次のレベルまで あと${data.remainingToNext}件` : " ・ 最大レベル"}
          </p>
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">挑戦中のミッション</h2>
          <LinkButton href={`/parent/missions/new?childId=${data.id}`} variant="secondary" className="min-h-10 text-sm">＋ 作る</LinkButton>
        </div>
        {data.activeChallenges.length === 0 ? (
          <EmptyState>挑戦中のミッションはありません</EmptyState>
        ) : (
          <ul className="space-y-2">
            {data.activeChallenges.map((c) => (
              <li key={c.challengeId}>
                <Card className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{c.title}</p>
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <StatusBadge status={c.status} />
                      {c.dueDate ? `期限 ${formatMonthDay(c.dueDate)}` : "期限なし"}
                    </p>
                  </div>
                  {c.pendingSubmissionId ? (
                    <LinkButton href={`/parent/approvals/${c.pendingSubmissionId}`} variant="secondary" className="min-h-10 text-sm">
                      承認待ちの申請があります
                    </LinkButton>
                  ) : c.canComplete ? (
                    <Button className="min-h-10 text-sm" onClick={() => setTarget({ challengeId: c.challengeId, childName: data.displayName, missionTitle: c.title })}>
                      達成を登録
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">達成の記録</h2>
        {byMonth.length === 0 ? (
          <EmptyState>まだ達成したミッションはありません</EmptyState>
        ) : (
          byMonth.map(([month, items]) => (
            <Card key={month}>
              <h3 className="mb-2 font-bold">
                {Number(month.slice(0, 4))}年{Number(month.slice(5, 7))}月 <span className="text-sm font-normal text-muted">{items.length}件</span>
              </h3>
              <ul className="divide-y divide-line">
                {items.map((h) => (
                  <li key={h.challengeId} className="flex justify-between py-2 text-sm">
                    <span>{h.title}{h.source === "PARENT" && <span className="ml-2 text-xs text-muted">（保護者が登録）</span>}</span>
                    <span className="text-muted">{formatMonthDay(new Date(h.approvedAt))}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </section>

      <CompleteModal target={target} onClose={() => setTarget(null)} onDone={reload} />
    </div>
  );
}
