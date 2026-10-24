"use client";

// P-M2 達成登録モーダル（F-APV-08）。保護者が見届けた達成を、子どもの申請なしで登録する
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import type { ReviewResult } from "@/lib/types";
import { Button, ErrorBanner, Field, inputClass, Modal } from "@/components/ui";
import { useParentApi } from "./ReauthProvider";
import { CommentTemplates } from "./CommentTemplates";

export type CompleteTarget = { challengeId: string; childName: string; missionTitle: string };

export function CompleteModal({
  target,
  onClose,
  onDone,
}: {
  target: CompleteTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const call = useParentApi();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  useEffect(() => {
    setComment("");
    setError(null);
    setResult(null);
  }, [target]);

  async function submit() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const r = await call<ReviewResult>(`/challenges/${target.challengeId}/complete`, { method: "POST", body: { comment } });
      setResult(r);
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === "REAUTH_CANCELLED") return;
      setError(e instanceof ApiError ? e.message : "エラーが発生しました");
      if (e instanceof ApiError && e.status === 409) onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!target} onClose={onClose} title="達成を登録">
      {target && result ? (
        <div className="space-y-4">
          <p className="text-lg font-bold text-success">達成を登録しました</p>
          {result.child.leveledUp && <p className="font-bold">{target.childName}さんが Lv.{result.child.level} になりました！</p>}
          <p className="text-sm text-muted">お子さまが次にアプリを開いたときに、お知らせが表示されます。</p>
          <Button block onClick={onClose}>閉じる</Button>
        </div>
      ) : target ? (
        <div className="space-y-4">
          <p>
            <span className="font-bold">{target.childName}</span> さんの「<span className="font-bold">{target.missionTitle}</span>」を達成にします。
          </p>
          <ErrorBanner message={error} />
          <Field label="褒めコメント（任意）" hint="100文字まで。お子さまの画面に表示されます">
            {(id, d) => (
              <textarea id={id} aria-describedby={d} className={`${inputClass()} py-2`} rows={2} maxLength={100} value={comment} onChange={(e) => setComment(e.target.value)} />
            )}
          </Field>
          <CommentTemplates onPick={setComment} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>やめる</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "登録中…" : "達成にする"}</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
