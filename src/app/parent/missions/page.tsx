"use client";

// P-02 ミッション一覧（F-MIS-02, 04, 05, F-APV-08）
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CHALLENGE_STATUS_LABEL, VERIFY_METHOD_LABEL, type ChallengeStatus } from "@/lib/constants";
import { api, errorMessage } from "@/lib/api";
import { formatMonthDay } from "@/lib/date";
import { useApi } from "@/lib/hooks";
import type { ChildrenListResponse, Mission, MissionChallenge, MissionListResponse } from "@/lib/types";
import { Button, Card, EmptyState, ErrorBanner, LinkButton, Loading, Modal, PageTitle } from "@/components/ui";
import { CATEGORY_EMOJI, StatusBadge } from "@/components/StatusBadge";
import { CompleteModal, type CompleteTarget } from "@/components/parent/CompleteModal";

const FILTERS: (ChallengeStatus | "")[] = ["", "OPEN", "PENDING", "REJECTED", "APPROVED", "EXPIRED", "ARCHIVED"];

export default function MissionsPage() {
  const { data: children } = useApi<ChildrenListResponse>("/children");
  const [childId, setChildId] = useState("");
  const [status, setStatus] = useState<ChallengeStatus | "">("");
  const [items, setItems] = useState<Mission[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = useState<CompleteTarget | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ challenge: MissionChallenge; title: string } | null>(null);

  const query = useCallback(
    (after?: string | null) => {
      const q = new URLSearchParams();
      if (childId) q.set("childId", childId);
      if (status) q.set("status", status);
      if (after) q.set("cursor", after);
      return `/missions?${q.toString()}`;
    },
    [childId, status],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<MissionListResponse>(query());
      setItems(r.items);
      setCursor(r.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function more() {
    if (!cursor) return;
    const r = await api<MissionListResponse>(query(cursor));
    setItems((s) => [...s, ...r.items]);
    setCursor(r.nextCursor);
  }

  async function archive() {
    if (!archiveTarget) return;
    try {
      await api(`/challenges/${archiveTarget.challenge.id}/archive`, { method: "POST" });
      setArchiveTarget(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
      setArchiveTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle action={<LinkButton href="/parent/missions/new">＋ 作る</LinkButton>}>ミッション</PageTitle>

      <div className="flex flex-wrap gap-2">
        <select aria-label="子どもで絞り込む" className="min-h-10 rounded-xl border border-line bg-white px-2" value={childId} onChange={(e) => setChildId(e.target.value)}>
          <option value="">全員</option>
          {children?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.displayName}</option>
          ))}
        </select>
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="状態で絞り込む">
          {FILTERS.map((f) => (
            <button
              key={f || "all"}
              type="button"
              role="tab"
              aria-selected={status === f}
              onClick={() => setStatus(f)}
              className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-bold ${status === f ? "bg-parent-primary text-white" : "bg-white text-muted ring-1 ring-line"}`}
            >
              {f ? CHALLENGE_STATUS_LABEL[f] : "すべて"}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} />
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState>ミッションはありません</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id}>
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">
                      <span aria-hidden>{CATEGORY_EMOJI[m.categoryCode] ?? "⭐"} </span>
                      {m.title}
                    </p>
                    <p className="text-sm text-muted">
                      {VERIFY_METHOD_LABEL[m.verifyMethod]}
                      {m.dueDate ? ` ・ 期限 ${formatMonthDay(m.dueDate)}` : " ・ 期限なし"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 text-sm">
                    <Link className="rounded-lg px-2 py-1 text-parent-primary underline" href={`/parent/missions/${m.id}/edit`}>編集</Link>
                    <Link className="rounded-lg px-2 py-1 text-parent-primary underline" href={`/parent/missions/new?from=${m.id}`}>複製</Link>
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-line">
                  {m.challenges.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="flex items-center gap-2">
                        <span className="font-bold">{c.childName}</span>
                        <StatusBadge status={c.status} />
                      </span>
                      <span className="flex gap-2">
                        {c.pendingSubmissionId && (
                          <LinkButton href={`/parent/approvals/${c.pendingSubmissionId}`} variant="secondary" className="min-h-10 text-sm">
                            確認する
                          </LinkButton>
                        )}
                        {c.canComplete && (
                          <Button className="min-h-10 text-sm" onClick={() => setCompleteTarget({ challengeId: c.id, childName: c.childName, missionTitle: m.title })}>
                            達成を登録
                          </Button>
                        )}
                        {(c.status === "OPEN" || c.status === "REJECTED") && (
                          <Button variant="ghost" className="min-h-10 text-sm" onClick={() => setArchiveTarget({ challenge: c, title: m.title })}>
                            取り下げ
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <Button variant="secondary" block onClick={more}>もっと見る</Button>
      )}

      <CompleteModal target={completeTarget} onClose={() => setCompleteTarget(null)} onDone={load} />
      <Modal open={!!archiveTarget} onClose={() => setArchiveTarget(null)} title="ミッションを取り下げますか？">
        <p>
          {archiveTarget?.challenge.childName} さんの「{archiveTarget?.title}」を取り下げます。お子さまの画面から消えます。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setArchiveTarget(null)}>やめる</Button>
          <Button variant="danger" onClick={archive}>取り下げる</Button>
        </div>
      </Modal>
    </div>
  );
}
