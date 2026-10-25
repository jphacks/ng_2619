"use client";

// P-05 申請詳細・承認（F-APV-03〜05, 07。基本設計書 3.4）
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TARGET_UNIT_LABEL, VERIFY_METHOD_LABEL } from "@/lib/constants";
import { api, ApiError } from "@/lib/api";
import { formatDateTimeJst, formatMonthDay } from "@/lib/date";
import { useApi } from "@/lib/hooks";
import type { ReviewResult, SubmissionDetail } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass, LinkButton, Loading } from "@/components/ui";
import { useParentApi } from "@/components/parent/ReauthProvider";
import { CommentTemplates } from "@/components/parent/CommentTemplates";

function VideoPanel({ detail, reload }: { detail: SubmissionDetail; reload: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = detail.video?.status;

  const fetchUrl = useCallback(async () => {
    try {
      const r = await api<{ url: string }>(`/submissions/${detail.id}/video-url`);
      setUrl(r.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "動画を読み込めませんでした");
    }
  }, [detail.id]);

  useEffect(() => {
    if (status === "READY") void fetchUrl();
    // 変換中は15秒ごとに状態を読み直す
    if (status === "PROCESSING" || status === "UPLOADING") {
      const t = setInterval(reload, 15_000);
      return () => clearInterval(t);
    }
  }, [status, fetchUrl, reload]);

  if (!detail.video) return null;
  if (status === "PROCESSING" || status === "UPLOADING") {
    return <p className="rounded-xl bg-slate-100 p-4 text-center text-muted">動画を準備しています（数分かかります）</p>;
  }
  if (status === "FAILED") {
    return <p className="rounded-xl bg-amber-100 p-4 text-center font-bold text-amber-900">動画を表示できません。目視で確認してください</p>;
  }
  if (status === "DELETED") {
    return <p className="rounded-xl bg-slate-100 p-4 text-center text-muted">動画の保存期間が過ぎました</p>;
  }
  if (error) return <ErrorBanner message={error} />;
  if (!url) return <Loading label="動画を読み込み中…" />;
  // 署名付きURLは10分で切れるため、再生エラー時はURLを取り直す
  return <video key={url} src={url} controls playsInline className="w-full rounded-xl bg-black" onError={() => void fetchUrl()} />;
}

export default function ApprovalDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const call = useParentApi();
  const { data, error, loading, reload } = useApi<SubmissionDetail>(`/submissions/${submissionId}`);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  async function review(kind: "approve" | "reject") {
    if (kind === "reject" && !comment.trim()) {
      setFieldError("差し戻す理由を入力してください");
      return;
    }
    setBusy(true);
    setActionError(null);
    setFieldError(undefined);
    try {
      setResult(await call<ReviewResult>(`/submissions/${submissionId}/${kind}`, { method: "POST", body: { comment } }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "REAUTH_CANCELLED") return;
      if (e instanceof ApiError && e.status === 409) {
        setActionError("すでに処理済みです");
        reload();
      } else {
        setActionError(e instanceof ApiError ? e.message : "エラーが発生しました");
        setFieldError(e instanceof ApiError ? e.fields?.comment : undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBanner message={error?.message ?? "見つかりません"} />;
  const m = data.mission;

  if (result) {
    return (
      <Card className="space-y-4 text-center">
        <p className="text-xl font-bold">{result.challengeStatus === "APPROVED" ? "承認しました" : "差し戻しました"}</p>
        {result.child.leveledUp && <p className="font-bold text-kid-primary">{data.child.displayName}さんが Lv.{result.child.level} になりました！</p>}
        <p className="text-sm text-muted">お子さまが次にアプリを開いたときに、お知らせが表示されます。</p>
        <LinkButton href="/parent/approvals" block>承認待ち一覧へ戻る</LinkButton>
      </Card>
    );
  }

  const reviewable = data.reviewResult === null && data.challengeStatus === "PENDING";
  return (
    <div className="space-y-4">
      <Link href="/parent/approvals" className="text-sm text-parent-primary underline">‹ 承認待ち一覧</Link>
      <Card className="space-y-2">
        <p className="text-sm text-muted">
          {data.child.displayName} ・ {formatDateTimeJst(data.submittedAt)} ・ {data.method === "VIDEO" ? "🎥 動画" : "👀 目視"}
        </p>
        <h1 className="text-xl font-bold">{m.title}</h1>
        {m.description && <p>{m.description}</p>}
        <p className="text-sm text-muted">
          {m.targetValue && m.targetUnit ? `目標 ${m.targetValue}${TARGET_UNIT_LABEL[m.targetUnit]} ・ ` : ""}
          {VERIFY_METHOD_LABEL[m.verifyMethod]}
          {m.dueDate ? ` ・ 期限 ${formatMonthDay(m.dueDate)}` : ""}
        </p>
        {data.stampLabel && <p className="rounded-xl bg-kid-soft p-2 font-bold">ひとこと：「{data.stampLabel}」</p>}
      </Card>

      <VideoPanel detail={data} reload={reload} />
      {data.childComment && (
        <Card className="space-y-2">
          <h2 className="font-bold">お子さまからのコメント</h2>
          <p className="whitespace-pre-wrap break-words">{data.childComment}</p>
        </Card>
      )}
      {data.method === "VISUAL" && (
        <p className="rounded-xl bg-white p-3 text-sm ring-1 ring-black/5">お子さまから「おうちのひとに みてもらった」と申請がありました。見届けた内容を確認して承認してください。</p>
      )}

      <ErrorBanner message={actionError} />
      {reviewable ? (
        <Card className="space-y-3">
          <Field label="コメント" hint="承認は任意、差し戻しは必須（100文字まで）" error={fieldError}>
            {(id, d) => (
              <textarea id={id} aria-describedby={d} className={`${inputClass("parent", !!fieldError)} py-2`} rows={2} maxLength={100} value={comment} onChange={(e) => setComment(e.target.value)} />
            )}
          </Field>
          <CommentTemplates onPick={setComment} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => review("reject")}>差し戻す</Button>
            <Button disabled={busy} onClick={() => review("approve")}>承認する</Button>
          </div>
        </Card>
      ) : (
        <p className="rounded-xl bg-slate-100 p-3 text-center font-bold text-muted">
          この申請は処理済みです{data.reviewResult ? `（${data.reviewResult === "APPROVED" ? "承認" : "差し戻し"}）` : ""}
        </p>
      )}
    </div>
  );
}
