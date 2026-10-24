"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LoginResponse } from "@/lib/types";
import { Button, ErrorBanner, Field, inputClass } from "@/components/ui";

/** ログイン後に戻る先。自サイトのパスだけ許可する（オープンリダイレクト対策） */
function safeNext(next: string | null, role: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (role === "CHILD" && !next.startsWith("/kids")) return null;
  if (role === "PARENT" && !next.startsWith("/parent")) return null;
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<LoginResponse>("/auth/login", { method: "POST", body: { loginId, password } });
      router.replace(safeNext(params.get("next"), r.role) ?? r.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ログインできませんでした");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <ErrorBanner message={error} />
      <Field label="ユーザID" tone="kid">
        {(id, d) => (
          <input
            id={id}
            aria-describedby={d}
            className={inputClass("kid")}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            inputMode="email"
            required
          />
        )}
      </Field>
      <Field label="パスワード" tone="kid">
        {(id, d) => (
          <div className="flex gap-2">
            <input
              id={id}
              aria-describedby={d}
              className={inputClass("kid")}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button variant="secondary" onClick={() => setShow((s) => !s)} aria-pressed={show} className="min-h-14 shrink-0">
              {show ? "かくす" : "みせる"}
            </Button>
          </div>
        )}
      </Field>
      <Button tone="kid" type="submit" block disabled={busy}>
        {busy ? "ログイン中…" : "ログイン"}
      </Button>
      <p className="text-center text-sm text-muted">こどもの パスワードは おうちのひとに きいてね</p>
      <div className="space-y-2 border-t border-line pt-4 text-center text-sm">
        <p>
          <Link className="font-bold text-parent-primary underline" href="/signup">
            新規登録（保護者の方）
          </Link>
        </p>
        <p>
          <Link className="text-parent-primary underline" href="/password-reset">
            パスワードを忘れた方（保護者）
          </Link>
        </p>
      </div>
    </form>
  );
}
