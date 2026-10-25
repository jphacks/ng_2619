import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

// S-01 ログイン。メンテナンス告知（NF-A-02）は実行時の環境変数から出す
export default function LoginPage() {
  const notice = process.env.MAINTENANCE_NOTICE || null;
  return (
    <main className="mx-auto max-w-[480px] px-4 py-10">
      {notice && (
        <div role="status" className="mb-6 rounded-xl bg-amber-100 p-3 text-sm font-extrabold text-amber-900">
          {notice}
        </div>
      )}
      <h1 className="text-center text-7xl font-extrabold text-kid-primary" style={{ WebkitTextStroke: "0.1px white" }}>ちるちゃれ</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
