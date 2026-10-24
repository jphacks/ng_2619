"use client";

// S-03 パスワード再設定（メールアドレス入力）F-AUTH-07
import Link from "next/link";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Button, ErrorBanner, Field, inputClass } from "@/components/ui";

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/password-reset/request", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4 py-10">
      <h1 className="text-2xl font-bold">パスワードの再設定（保護者）</h1>
      {sent ? (
        <div className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <p>入力されたメールアドレス宛てに、再設定用のURLを送信しました。30分以内に手続きしてください。</p>
          <p className="text-sm text-muted">メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
          <Link href="/login" className="text-parent-primary underline">ログイン画面へ戻る</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <ErrorBanner message={error} />
          <p className="text-sm text-muted">お子さまのパスワードは、保護者の画面から再設定できます。</p>
          <Field label="登録したメールアドレス">
            {(id) => <input id={id} type="email" className={inputClass()} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />}
          </Field>
          <Button type="submit" block disabled={busy}>再設定URLを送る</Button>
          <p className="text-center text-sm"><Link href="/login" className="text-parent-primary underline">ログイン画面へ戻る</Link></p>
        </form>
      )}
    </main>
  );
}
