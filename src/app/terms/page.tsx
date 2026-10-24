import Link from "next/link";

// S-04 利用規約（仮の文面）【要確認 BQ-09 / 要件定義書 Q-21】正式な文面は T-1008 で作成する
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[640px] space-y-4 px-4 py-8 leading-relaxed">
      <h1 className="text-2xl font-bold">利用規約（仮）</h1>
      <p className="rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
        この文面は開発用の仮のものです。公開前に正式な文面へ差し替えます。
      </p>
      <h2 className="text-lg font-bold">1. サービスの内容</h2>
      <p>本サービスは、保護者が設定した運動ミッションに子どもが挑戦し、保護者が達成を確認するためのサービスです。</p>
      <h2 className="text-lg font-bold">2. 保護者の責任</h2>
      <p>ミッションの内容（安全性・難易度）は保護者が責任を持って設定してください。外遊びの際は、交通安全や周囲の安全に十分注意してください。</p>
      <h2 className="text-lg font-bold">3. 子どものアカウント</h2>
      <p>子どものアカウントは保護者が作成・管理します。保護者は、子どもの利用について法定代理人として同意したものとみなします。</p>
      <h2 className="text-lg font-bold">4. 免責</h2>
      <p>本サービスの利用中に発生したけが・事故について、運営者は責任を負いません。</p>
      <Link href="/login" className="text-parent-primary underline">戻る</Link>
    </main>
  );
}
