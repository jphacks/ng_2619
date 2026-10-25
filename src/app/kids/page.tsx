"use client";

// C-01 子どもホーム（F-CHL-01, 06, F-LV-02, 03, NF-U-08）
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CHALLENGE_STATUS_KIDS_LABEL } from "@/lib/constants";
import { api } from "@/lib/api";
import { kidsLabel, formatMonthDayForGrade } from "@/lib/kids-labels";
import { useApi } from "@/lib/hooks";
import type { KidsHome, KidsNotice } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorBanner, Loading } from "@/components/ui";
import { CATEGORY_EMOJI } from "@/components/StatusBadge";
import { LevelUpModal } from "@/components/kids/LevelUpModal";

const NOTICE_TEXT: Record<KidsNotice["kind"], (title: string) => string> = {
  APPROVED: (t) => `「${t}」 たっせい！ おうちのひとが ほめてくれたよ`,
  PARENT_COMPLETED: (t) => `おうちのひとが 「${t}」を たっせいに したよ！`,
  REJECTED: (t) => `「${t}」 もういちど ちょうせんしよう`,
};

export default function KidsHomePage() {
  const router = useRouter();
  const { data, error, loading, setData } = useApi<KidsHome>("/kids/home");
  const [showLevelUp, setShowLevelUp] = useState(true);

  useEffect(() => {
    // 初回はアバターを作ってもらう（F-AVT-01）
    if (data && !data.child.avatarInitialized) router.replace("/kids/avatar?initial=1");
  }, [data, router]);

  async function dismiss(notice: KidsNotice) {
    setData((d) => (d ? { ...d, notices: d.notices.filter((n) => n.submissionId !== notice.submissionId) } : d));
    await api("/kids/notices/ack", { method: "POST", body: { submissionIds: [notice.submissionId] } }).catch(() => undefined);
  }

  async function closeLevelUp(next?: string) {
    setShowLevelUp(false);
    await api("/kids/level-up/ack", { method: "POST" }).catch(() => undefined);
    if (next) router.push(next);
  }

  if (loading && !data) return <Loading label="よみこみちゅう…" />;
  if (error) return <ErrorBanner message={error.message} />;
  if (!data || !data.child.avatarInitialized) return null;
  const { child } = data;
  const span = child.levelEnd !== null ? child.levelEnd - child.levelStart : 0;
  const progress = span > 0 ? Math.min(100, Math.round(((child.approvedCount - child.levelStart) / span) * 100)) : 100;

  return (
    <div className="space-y-5">
      <section className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm">
        <Link href="/kids/avatar" aria-label="アバターを きせかえる">
          <Avatar layers={data.avatar} size={128} label={`${child.displayName}の アバター`} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold">{child.displayName}</p>
          <p className="text-3xl font-bold text-kid-primary">Lv.{child.level}</p>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-kid-soft" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="つぎの レベルまで">
            <div className="h-full rounded-full bg-kid-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-base">
            {child.remainingToNext !== null ? (<>つぎの レベルまで <span className="whitespace-nowrap">あと {child.remainingToNext}こ</span></>) : "いちばん うえの レベルだよ！"}
          </p>
        </div>
      </section>

      {data.notices.map((n) => (
        <section
          key={n.submissionId}
          className={`rounded-3xl p-4 ${n.kind === "REJECTED" ? "bg-orange-100" : "bg-kid-soft"}`}
          aria-live="polite"
        >
          <p className="text-xl font-bold">{n.kind === "REJECTED" ? "💪" : "🎉"} {NOTICE_TEXT[n.kind](n.missionTitle)}</p>
          {n.comment && <p className="mt-2 text-lg">おうちのひとから：「{n.comment}」</p>}
          <button type="button" onClick={() => void dismiss(n)} className="mt-3 min-h-12 rounded-xl bg-white px-4 font-bold">
            わかった
          </button>
        </section>
      ))}

      {data.safetyMessage && (
        <p className="rounded-2xl bg-kid-sun p-3 text-center text-lg font-bold" role="note">
          ⚠️ {data.safetyMessage}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">ミッション</h2>
        {data.challenges.length === 0 ? (
          <EmptyState>
            <p className="text-lg">おうちのひとに ミッションを つくってもらおう</p>
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {data.challenges.map((c) => (
              <li key={c.id}>
                <Link href={`/kids/challenges/${c.id}`} className="flex min-h-20 items-center gap-4 rounded-3xl bg-white p-4 shadow-sm active:scale-[0.99]">
                  <span className="text-4xl" aria-hidden>{CATEGORY_EMOJI[c.categoryCode] ?? "⭐"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xl font-bold">{c.title}</span>
                    <span className="block text-base text-muted">
                      {c.targetValue && c.targetUnit ? `${kidsLabel("target", c.grade)} ${c.targetValue}${c.targetUnitLabel}　` : ""}
                      {c.dueDate ? `${kidsLabel("deadline", c.grade)} ${formatMonthDayForGrade(c.dueDate, c.grade)}まで` : ""}
                    </span>
                    <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-base font-bold ${c.status === "PENDING" ? "bg-orange-100 text-orange-900" : c.status === "REJECTED" ? "bg-red-100 text-red-900" : "bg-kid-soft text-kid-primary-dark"}`}>
                      {CHALLENGE_STATUS_KIDS_LABEL[c.status]}
                    </span>
                  </span>
                  <span className="text-2xl text-muted" aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.levelUp && showLevelUp && (
        <LevelUpModal levelUp={data.levelUp} onClose={() => void closeLevelUp()} onDressUp={() => void closeLevelUp("/kids/avatar")} />
      )}
    </div>
  );
}
