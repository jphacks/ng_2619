"use client";

// S-02 保護者新規登録（F-AUTH-03）
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LoginResponse } from "@/lib/types";
import { Button, ErrorBanner, Field, inputClass } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ loginId: "", password: "", password2: "", displayName: "", email: "", agreeTerms: false });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.password2) {
      setFields({ password2: "パスワードが一致しません" });
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const body = { loginId: form.loginId, password: form.password, displayName: form.displayName, email: form.email, agreeTerms: form.agreeTerms };
      const r = await api<LoginResponse>("/auth/signup", { method: "POST", body });
      router.replace(r.redirectTo);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      }
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[520px] px-4 py-8">
      <h1 className="text-2xl font-bold">保護者の新規登録</h1>
      <p className="mt-1 text-sm text-muted">お子さまのアカウントは、登録後に保護者の画面から作成します。</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <ErrorBanner message={error} />
        <Field label="ユーザID" hint="半角英数字と _ で4〜20文字" error={fields.loginId}>
          {(id, d) => <input id={id} aria-describedby={d} className={inputClass("parent", !!fields.loginId)} value={form.loginId} onChange={set("loginId")} autoComplete="username" autoCapitalize="none" required />}
        </Field>
        <Field label="パスワード" hint="8文字以上で、英字と数字をそれぞれ1文字以上" error={fields.password}>
          {(id, d) => <input id={id} aria-describedby={d} type="password" className={inputClass("parent", !!fields.password)} value={form.password} onChange={set("password")} autoComplete="new-password" required />}
        </Field>
        <Field label="パスワード（確認）" error={fields.password2}>
          {(id, d) => <input id={id} aria-describedby={d} type="password" className={inputClass("parent", !!fields.password2)} value={form.password2} onChange={set("password2")} autoComplete="new-password" required />}
        </Field>
        <Field label="表示名" hint="お子さまの画面に出る呼び名です（例：おかあさん）。10文字まで" error={fields.displayName}>
          {(id, d) => <input id={id} aria-describedby={d} className={inputClass("parent", !!fields.displayName)} value={form.displayName} onChange={set("displayName")} maxLength={10} required />}
        </Field>
        <Field label="メールアドレス" hint="パスワードを忘れたときの再設定に使います" error={fields.email}>
          {(id, d) => <input id={id} aria-describedby={d} type="email" className={inputClass("parent", !!fields.email)} value={form.email} onChange={set("email")} autoComplete="email" required />}
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={form.agreeTerms} onChange={set("agreeTerms")} />
          <span>
            <Link href="/terms" className="text-parent-primary underline" target="_blank">利用規約</Link>と
            <Link href="/privacy" className="text-parent-primary underline" target="_blank">プライバシーポリシー</Link>
            に同意します（お子さまの利用について、法定代理人として同意します）
          </span>
        </label>
        {fields.agreeTerms && <p className="text-sm font-bold text-danger">{fields.agreeTerms}</p>}
        <Button type="submit" block disabled={busy || !form.agreeTerms}>
          {busy ? "登録中…" : "登録する"}
        </Button>
        <p className="text-center text-sm">
          <Link href="/login" className="text-parent-primary underline">ログイン画面へ戻る</Link>
        </p>
      </form>
    </main>
  );
}
