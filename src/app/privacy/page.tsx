import Link from "next/link";

// S-05 プライバシーポリシー（仮の文面）【要確認 BQ-04 / BQ-09 / 要件定義書 Q-21】
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[640px] space-y-4 px-4 py-8 leading-relaxed">
      <h1 className="text-2xl font-bold">プライバシーポリシー（仮）</h1>
      <p className="rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
        この文面は開発用の仮のものです。公開前に正式な文面へ差し替えます。
      </p>
      <h2 className="text-lg font-bold">1. 取得する情報</h2>
      <p>保護者のユーザID・表示名・メールアドレス、子どものユーザID・表示名（ニックネーム）・学年、ミッションの記録、達成報告の動画。子どもの本名・生年月日・学校名・住所は取得しません。</p>
      <h2 className="text-lg font-bold">2. 動画の取り扱い</h2>
      <p>動画は同じ家族の保護者だけが見られます。撮影場所などの情報は削除して保存し、保護者が確認してから30日後に自動で削除します。</p>
      <h2 className="text-lg font-bold">3. 退会時の削除</h2>
      <p>退会から30日以内に、家族のすべてのデータを削除します。バックアップには最大7日間残ることがあります。</p>
      <Link href="/login" className="text-parent-primary underline">戻る</Link>
    </main>
  );
}
