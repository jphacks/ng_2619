"use client";

// P-04 承認待ち一覧（F-APV-02）。申請日時の古い順
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDateTimeJst } from "@/lib/date";
import { useApi } from "@/lib/hooks";
import type { PendingListResponse, PendingSubmission } from "@/lib/types";
import { Button, Card, EmptyState, ErrorBanner, Loading, PageTitle } from "@/components/ui";

export default function ApprovalsPage() {
  const { data, error, loading } = useApi<PendingListResponse>("/submissions?status=PENDING");
  const [extra, setExtra] = useState<PendingSubmission[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const next = cursor === undefined ? data?.nextCursor : cursor;

  async function more() {
    if (!next) return;
    const r = await api<PendingListResponse>(`/submissions?status=PENDING&cursor=${next}`);
    setExtra((s) => [...s, ...r.items]);
    setCursor(r.nextCursor);
  }

  if (loading && !data) return <Loading />;
  const items = [...(data?.items ?? []), ...extra];
  return (
    <div className="space-y-4">
      <PageTitle>承認待ち</PageTitle>
      <ErrorBanner message={error?.message} />
      {items.length === 0 ? (
        <EmptyState>承認待ちの申請はありません</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.id}>
              <Link href={`/parent/approvals/${s.id}`} className="block">
                <Card className="flex items-center gap-3 hover:ring-parent-primary">
                  <span className="text-3xl" aria-label={s.method === "VIDEO" ? "動画" : "目視"}>
                    {s.method === "VIDEO" ? "🎥" : "👀"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{s.missionTitle}</p>
                    <p className="text-sm text-muted">
                      {s.childName} ・ {formatDateTimeJst(s.submittedAt)}
                      {s.stampLabel ? ` ・ 「${s.stampLabel}」` : ""}
                    </p>
                  </div>
                  <span aria-hidden className="text-muted">›</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {next && <Button variant="secondary" block onClick={more}>もっと見る</Button>}
    </div>
  );
}
