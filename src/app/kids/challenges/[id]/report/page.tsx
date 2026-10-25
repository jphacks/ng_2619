"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/hooks";
import type { KidsChallengeDetail } from "@/lib/types";
import { ErrorBanner, Loading } from "@/components/ui";
import KidsChallengeReportForm from "@/components/kids/KidsChallengeReportForm";

// 詳細画面と同じフォームを使い、撮影・検証・送信処理を一か所で管理する。
export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: challenge, error, loading } = useApi<KidsChallengeDetail>(`/kids/challenges/${id}`);
  if (loading) return <Loading label="よみこみちゅう…" />;
  if (error || !challenge) return <ErrorBanner message={error?.message ?? "みつからないよ"} />;
  return (
    <div className="space-y-5">
      <Link href={`/kids/challenges/${challenge.id}`} className="inline-flex min-h-12 items-center text-lg font-bold text-kid-primary">‹ もどる</Link>
      <KidsChallengeReportForm challenge={challenge} />
    </div>
  );
}
