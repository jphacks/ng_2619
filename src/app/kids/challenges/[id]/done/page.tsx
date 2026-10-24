import { LinkButton } from "@/components/ui";

// C-04 報告完了
export default function DonePage() {
  return (
    <div className="space-y-6 py-8 text-center">
      <p className="animate-pop text-7xl" aria-hidden>📨</p>
      <h1 className="text-3xl font-bold text-kid-primary">おくったよ！</h1>
      <p className="text-xl">おうちのひとの かくにんを まってね</p>
      <LinkButton tone="kid" href="/kids" block>ホームへ もどる</LinkButton>
    </div>
  );
}
