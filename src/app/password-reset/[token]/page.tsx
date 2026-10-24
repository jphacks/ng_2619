"use client";

// S-03 パスワード再設定（新しいパスワード入力）
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, ErrorBanner, Field, inputClass } from "@/components/ui";

export default function PasswordResetConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) {
      setFieldError("パスワードが一致しません");
      return;
    }
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    try {
      await api("/auth/password-reset/confirm", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldError(err.fields?.password);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4 py-10">
      <h1 className="text-2xl font-bold">新しいパスワードの設定</h1>
      {done ? (
        <div className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <p>パスワードを変更しました。新しいパスワードでログインしてください。</p>
          <Link href="/login" className="font-bold text-parent-primary underline">ログイン画面へ</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <ErrorBanner message={error} />
          <Field label="新しいパスワード" hint="8文字以上で、英字と数字をそれぞれ1文字以上" error={fieldError}>
            {(id, d) => <input id={id} aria-describedby={d} type="password" className={inputClass()} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />}
          </Field>
          <Field label="新しいパスワード（確認）">
            {(id) => <input id={id} type="password" className={inputClass()} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required />}
          </Field>
          <Button type="submit" block disabled={busy}>変更する</Button>
        </form>
      )}
    </main>
  );
}
