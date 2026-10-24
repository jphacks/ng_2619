"use client";

// P-M1 再認証モーダル（F-AUTH-10）。
// API が 403 REAUTH_REQUIRED を返したらモーダルを開き、パスワード入力に成功したら元の操作をやり直す。

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, ErrorBanner, Field, inputClass, Modal } from "@/components/ui";

type Ctx = { requestReauth: () => Promise<boolean> };
const ReauthContext = createContext<Ctx | null>(null);

export function ReauthProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const requestReauth = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setPassword("");
        setError(null);
        setOpen(true);
      }),
    [],
  );

  const finish = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reauth", { method: "POST", body: { password } });
      finish(true);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "AUTH_INVALID_CREDENTIALS" ? "パスワードが違います" : err instanceof ApiError ? err.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ReauthContext.Provider value={{ requestReauth }}>
      {children}
      <Modal open={open} onClose={() => finish(false)} title="保護者のパスワードを入力してください">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">
            お子さまが保護者の操作をしないよう、承認やアカウントの変更の前に確認しています（10分間有効）。
          </p>
          <ErrorBanner message={error} />
          <Field label="パスワード">
            {(id) => (
              <input id={id} type="password" className={inputClass()} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => finish(false)}>やめる</Button>
            <Button type="submit" disabled={busy}>確認する</Button>
          </div>
        </form>
      </Modal>
    </ReauthContext.Provider>
  );
}

/** 再認証が必要なら自動でモーダルを開いてやり直す api() */
export function useParentApi() {
  const ctx = useContext(ReauthContext);
  return useCallback(
    async <T,>(path: string, opts?: Parameters<typeof api>[1]): Promise<T> => {
      try {
        return await api<T>(path, opts);
      } catch (e) {
        if (e instanceof ApiError && e.code === "REAUTH_REQUIRED" && ctx) {
          if (await ctx.requestReauth()) return api<T>(path, opts);
          throw new ApiError(0, "REAUTH_CANCELLED", "操作をキャンセルしました");
        }
        throw e;
      }
    },
    [ctx],
  );
}
