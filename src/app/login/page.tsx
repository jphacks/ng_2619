import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

// S-01 ログイン。メンテナンス告知（NF-A-02）は実行時の環境変数から出す
export default function LoginPage() {
  const notice = process.env.MAINTENANCE_NOTICE || null;
  return (
    <main className="mx-auto max-w-[480px] px-4 py-10">
      {notice && (
        <div role="status" className="mb-6 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
          {notice}
        </div>
      )}
      <h1 className="text-center text-3xl font-bold text-kid-primary">そとあそびミッション</h1>
      <p className="mt-2 text-center text-muted">ログインしてね</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
