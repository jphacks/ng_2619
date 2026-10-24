"use client";

// S-99 エラー（500）
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[480px] px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">エラーが発生しました</h1>
      <p className="mt-2 text-lg">うまく いかなかったよ。もういちど ためしてね</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="min-h-12 rounded-xl bg-parent-primary px-4 font-bold text-white">
          もう一度
        </button>
        <a href="/login" className="inline-flex min-h-12 items-center rounded-xl border border-parent-primary px-4 font-bold text-parent-primary">
          ログイン画面へ
        </a>
      </div>
    </main>
  );
}
