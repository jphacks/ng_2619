"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Preview = { kanaTitle: string; kanaDescription: string; gradeTitle: string; gradeDescription: string };

export function MissionTextPreview({ title, description, grade }: { title: string; description: string; grade: number }) {
  const [result, setResult] = useState<{ key: string; value?: Preview; error?: string } | null>(null);
  const key = JSON.stringify([title, description, grade]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<Preview>("/text-preview", { method: "POST", body: { title, description, grade }, signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) setResult({ key, value }); })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ key, error: "読み方を取得できませんでした。入力内容を変えて再試行してください。" });
        });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [title, description, grade, key]);

  if (!title && !description) return <p className="text-sm text-muted">入力すると、自動変換した読み方を表示します。</p>;
  if (result?.key !== key) return <p role="status" className="text-sm text-muted">読み方を変換中…</p>;
  if (result.error) return <p role="alert" className="text-sm text-danger">{result.error}</p>;
  const value = result.value!;
  return (
    <div className="space-y-3" aria-live="polite">
      <div>
        <p className="text-xs font-bold text-muted">ひらがなの読み方</p>
        <p className="whitespace-pre-wrap text-lg">{value.kanaTitle || "（タイトル）"}</p>
        {value.kanaDescription && <p className="whitespace-pre-wrap">{value.kanaDescription}</p>}
      </div>
      <div>
        <p className="text-xs font-bold text-muted">小学{grade}年生の画面での見え方</p>
        <p className="whitespace-pre-wrap text-xl font-bold text-kid-ink">{value.gradeTitle || "（タイトル）"}</p>
        {value.gradeDescription && <p className="mt-1 whitespace-pre-wrap text-lg">{value.gradeDescription}</p>}
      </div>
    </div>
  );
}
