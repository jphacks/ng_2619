"use client";

// C-02 ミッション詳細（F-CHL-02）
import Link from "next/link";
import { useParams } from "next/navigation";
import { CHALLENGE_STATUS_KIDS_LABEL, TARGET_UNIT_KIDS_LABEL } from "@/lib/constants";
import { formatMonthDayKids } from "@/lib/date";
import { useApi } from "@/lib/hooks";
import type { KidsChallengeDetail } from "@/lib/types";
import { CATEGORY_EMOJI } from "@/components/StatusBadge";
import KidsChallengeReportForm from "@/components/kids/KidsChallengeReportForm";
import { ErrorBanner, Loading } from "@/components/ui";

const HOW: Record<KidsChallengeDetail["verifyMethod"], string> = {
  VIDEO: "どうがを とって おくってね",
  VISUAL: "おうちのひとに みてもらってね",
  EITHER: "どうがでも、おうちのひとに みてもらっても いいよ",
};

export default function KidsChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<KidsChallengeDetail>(`/kids/challenges/${id}`);

  if (loading) return <Loading label="よみこみちゅう…" />;
  if (error || !data) return <ErrorBanner message={error?.message ?? "みつからないよ"} />;
  const canReport = data.status === "OPEN" || data.status === "REJECTED";

  return (
    <div className="space-y-5">
      <Link href="/kids" className="inline-flex min-h-12 items-center text-lg font-bold text-kid-primary">‹ もどる</Link>
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-5xl" aria-hidden>{CATEGORY_EMOJI[data.categoryCode] ?? "⭐"}</p>
        <h1 className="mt-2 text-2xl font-bold">{data.title}</h1>
        {data.description && <p className="mt-3 text-xl leading-relaxed">{data.description}</p>}
        <dl className="mt-4 space-y-2 text-lg">
          {data.targetValue && data.targetUnit && (
            <div className="flex gap-2"><dt className="font-bold">もくひょう</dt><dd>{data.targetValue}{TARGET_UNIT_KIDS_LABEL[data.targetUnit]}</dd></div>
          )}
          {data.dueDate && (
            <div className="flex gap-2"><dt className="font-bold">きげん</dt><dd>{formatMonthDayKids(data.dueDate)}まで</dd></div>
          )}
          <div className="flex gap-2"><dt className="font-bold">ほうこく</dt><dd>{HOW[data.verifyMethod]}</dd></div>
        </dl>
      </section>

      {data.status === "REJECTED" && data.rejectionComment && (
        <section className="rounded-3xl bg-orange-100 p-4 text-lg">
          <p className="font-bold">おうちのひとから</p>
          <p className="mt-1">「{data.rejectionComment}」</p>
        </section>
      )}

      <p className="rounded-2xl bg-kid-sun p-3 text-center text-lg font-bold">⚠️ くるまに きをつけて あそぼう</p>

      {canReport ? (
        <KidsChallengeReportForm challenge={data} />
      ) : (
        <p className="rounded-2xl bg-white p-4 text-center text-xl font-bold text-muted">
        {CHALLENGE_STATUS_KIDS_LABEL[data.status] ?? "この ミッションは おわったよ"}
        </p>
    )}
      
    </div>
  );
}
