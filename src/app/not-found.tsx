import Link from "next/link";

// S-99 エラー（404）
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[480px] px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">ページが見つかりません</h1>
      <p className="mt-2 text-lg">ページが みつからないよ</p>
      <Link href="/" className="mt-6 inline-block font-bold text-parent-primary underline">はじめの がめんへ</Link>
    </main>
  );
}
