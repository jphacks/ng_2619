"use client";

// C-05 きろく（F-CHL-07）
import { formatMonthDayForGrade } from "@/lib/kids-labels";
import { useApi } from "@/lib/hooks";
import type { KidsRecords } from "@/lib/types";
import { EmptyState, ErrorBanner, Loading } from "@/components/ui";

export default function RecordsPage() {
  const { data, error, loading } = useApi<KidsRecords>("/kids/records");
  if (loading) return <Loading label="よみこみちゅう…" />;
  if (error || !data) return <ErrorBanner message={error?.message} />;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">きろく</h1>
      <p className="rounded-3xl bg-white p-4 text-center text-xl font-bold shadow-sm">
        たっせいした ミッション <span className="text-4xl text-kid-primary">{data.approvedCount}</span> こ
      </p>
      {data.items.length === 0 ? (
        <EmptyState>
          <p className="text-lg">まだ ないよ。ミッションに ちょうせんしよう！</p>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.challengeId} className="rounded-3xl bg-white p-4 shadow-sm">
              <p className="text-base text-muted">{formatMonthDayForGrade(new Date(r.approvedAt), data.grade)}</p>
              <p className="text-xl font-bold">🏅 {r.title}</p>
              {r.comment && <p className="mt-1 text-lg">おうちのひとから：「{r.comment}」</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
